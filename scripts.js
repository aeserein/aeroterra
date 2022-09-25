//#region Elements
const menu = document.getElementById("menu");
const bars = document.getElementsByClassName("bar");
const form = document.getElementById("searchButton");
const formSearch = document.getElementById("formSearch");
const searchResults = document.getElementsByClassName("searchResults")[0];
const fields = document.getElementsByClassName("fields")[0];
const divInformation = document.getElementsByClassName("divInformation")[0];

const divFields = document.getElementById("divFields");
const field_name = document.getElementById("name");
const field_address = document.getElementById("address");
const field_phone = document.getElementById("phone");
const field_category = document.getElementById("category");
const field_coordinates = document.getElementById("coordinates");
const field_coordinatesRaw = document.getElementById("coordinatesRaw");

const tab = document.getElementById("myPlacesTab");
const myPlaces = document.getElementById("myPlaces");
const myPlacesContainer = document.getElementById("myPlacesContainer");
const buttonCloseMyPlaces = document.getElementById("buttonCloseMyPlaces");
const buttonDeleteWrapper = document.getElementById("buttonDeleteWrapper");
const buttonDelete = document.getElementById("buttonDelete");
//#endregion

//#region Data
let apiKey = "AAPK1b41e6e295d842e0a87bbc29e2983a50XNkG_CzPx4GE-wTKJMcU_xgykDl645pD4XOFgKFig5kgY4TMYdFjwI6etgL1rfF4";
const categories = Object.freeze([
    {
        text: "Comercial",
        color: [150, 0, 20]
    },
    {
        text: "Residencial",
        color: [30, 10, 160]
    },
    {
        text: "Mixta",
        color: [110, 0, 110]
    }
]);
function truncate(float) {
	return Math.round((float + Number.EPSILON) * 10000) / 10000
}
class Place {
	constructor(name, address, phone, category, y, x) {
		this.name = name;
		this.address = address;
		this.phone = parseInt(phone);
		this.category = category;
		this.y = y;
		this.x = x;
	}

    drawDot(preview = false) {
        require(["esri/Graphic"], (Graphic)=> {

            const pointGeometry = {
                type: "point",
                longitude: this.x,
                latitude: this.y
            };
        
            const markerSymbol = {
                type: "simple-marker",
                color: preview ? [190, 194, 201] : categories[this.category].color,
                outline: {
                    color: [255, 255, 255],
                    width: 2
                }
            };
        
            let coordinates = humanReadableCoordinates(this.y, this.x)
            let attributes = {
                Direccion: this.address,
                Telefono: this.phone,
                Categoria: categories[this.category].text,
                Latitud: coordinates.latitude,
                Longitud: coordinates.longitude
            }
        
            let popupTemplate = {
                content: [
                    {
                        type: "fields",
                        fieldInfos: [
                            {
                                fieldName: "Latitud"
                            },
                            {
                                fieldName: "Longitud"
                            }
                        ]
                    }
                ]
            };
            if (this.category) popupTemplate.content[0].fieldInfos.unshift({fieldName: "Categoria"});
            if (this.phone) popupTemplate.content[0].fieldInfos.unshift({fieldName: "Telefono"});
            if (this.name) {
                popupTemplate.title = this.name;
                popupTemplate.content[0].fieldInfos.unshift({fieldName: "Direccion"});
            } else {
                popupTemplate.title = this.address;
            }
        
            this.removePoint();

            this.point = new Graphic({
                geometry: pointGeometry,
                symbol: markerSymbol,
                attributes: attributes,
                popupTemplate: popupTemplate
            });
            view.graphics.add(this.point);
        });
    }

    removePoint() {
        if (this.point)
            view.graphics.remove(this.point);
    }
}
function parsePlaces(candidates) {
	let places = [];
	for (let f = 0; f < candidates.length; f++) {
		let place = new Place(
			candidates[f].attributes.PlaceName,
			candidates[f].attributes.Place_addr,
			null,
			0,
			truncate(candidates[f].location.y),
			truncate(candidates[f].location.x)
		)
		places.push(place);
	}
	return places;
}
let savedPlaces = [];
function findSavedPlace(y, x) {
    return savedPlaces.findIndex((place)=> {
        return (
            Math.abs(y - place.y) <= 0.0001 &&
            Math.abs(x - place.x) <= 0.0001
        )
    });
}
function savePlace(place) {
    let index = findSavedPlace(place.y, place.x)

    if (index == -1) {  // New
        savedPlaces.push(place);
        place.drawDot();

        let fragment = document.createDocumentFragment();
        let div = document.createElement("div");
        div.classList.add("savedPlace");
        div.onclick = ()=> {
            goToPoint(place)
            fillFields(place, true);
            raiseSearchBar();
            closeMyPlaces();
        }
        let p1 = document.createElement("p");
        p1.innerHTML = place.name;
        let p2 = document.createElement("p");
        p2.innerHTML = place.address;
        div.appendChild(p1)
        div.appendChild(p2);
        fragment.appendChild(div);

        myPlacesContainer.append(fragment);

    } else {            // Modification
        savedPlaces[index] = place;
        savedPlaces[index].drawDot();
        let placeDom = myPlacesContainer.children[index];
        placeDom.children[0].innerHTML = savedPlaces[index].name;
        placeDom.children[1].innerHTML = savedPlaces[index].address;
    }
    localStorage.setItem("savedPlaces", JSON.stringify(savedPlaces));
}
function humanReadableCoordinates(y, x) {
    let coordinates = {};
    coordinates.latitude = (Math.abs(y) + "º");
    if (y < 0)
        coordinates.latitude += "S";
    else
        coordinates.latitude += "N";

    coordinates.longitude = (Math.abs(x) + "º");
    if (x < 0)
        coordinates.longitude += "W";
    else
        coordinates.longitude += "E";
    return coordinates;
}
//#endregion

//#region Queries
function httpGet(url, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            callback(xmlHttp.responseText);
        }
    }
    xmlHttp.open("GET", url, true);
    xmlHttp.send(null);
}
const FIND_ADDRESS_CANDIDATES = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&outFields=PlaceName,Place_addr&token=" + apiKey + "&address=";
//#endregion

//#region Map
let map, view, previewPlace;
require(
    [
        "esri/config",
        "esri/Map",
        "esri/views/MapView",
        "esri/widgets/Locate",
    ],
    (esriConfig, Map, MapView, Locate)=> {

        esriConfig.apiKey = apiKey;

        map = new Map({
            //basemap: "arcgis-topographic"
            basemap: "arcgis-navigation"
        });

        view = new MapView({
            map: map,
            center: [18.9553, 69.6492],
            zoom: 14,
            container: "viewDiv"
        });

        const locate = new Locate({
            view: view,
            useHeadingEnabled: false,
            goToOverride: function(view, options) {
                options.target.scale = 1500;
                return view.goTo(options.target);
            }
        });
        view.ui.add(locate, "top-left");

        let placesJson = JSON.parse(localStorage.getItem("savedPlaces"));
        if (placesJson) {
            for (let f = 0; f < placesJson.length; f++) {
                let p = new Place(placesJson[f].name, placesJson[f].address, placesJson[f].phone, placesJson[f].category, placesJson[f].y, placesJson[f].x);
                savePlace(p);
            }
            goToPoint(savedPlaces[savedPlaces.length-1]);
        }
	}
);
function goToPoint(place) {
	view.zoom = 16;
	view.goTo({
		center: [place.x, place.y]
	}).catch(function(error) {
		if (error.name != "AbortError") {
			console.error(error);
		}
	});
}
//#endregion

//#region Menu
for (let f = 0; f < bars.length; f++) {
    bars[f].onmousedown = ()=> {
        document.onmousemove = onDrag;
    } 
}
document.onmouseup = ()=> {
    document.onmousemove = null;
}
function onDrag(event) {
    let menuStyle = window.getComputedStyle(menu)
    let left = parseInt(menuStyle.left);
    let top = parseInt(menuStyle.top);
    menu.style.left = (left + event.movementX) + "px";
    menu.style.top = (top + event.movementY) + "px";
}
function fillCandidates(candidates) {
    fragment = document.createDocumentFragment();
    for (let f = 0; f < candidates.length; f++) {
        let div = document.createElement("div");
        div.classList.add("searchResult");
        div.onclick = ()=> {
            candidateOnClick(candidates[f]);
        }
        let p1 = document.createElement("p");
        p1.innerHTML = candidates[f].name;
        let p2 = document.createElement("p");
        p2.innerHTML = candidates[f].address;
        div.appendChild(p1)
        div.appendChild(p2);
        fragment.appendChild(div);
    }
    searchResults.innerHTML = "";
    showSearchResults()
    buttonDeleteWrapper.classList.add("retract");
    searchResults.appendChild(fragment);
}
function fillFields(place, withDeleteButton = false) {
    field_name.value = place.name;
    field_address.value = place.address;
    field_phone.value = place.phone;
    field_category.value = place.category;
    field_coordinatesRaw.value = place.y + "," + place.x;
    let coordinates = humanReadableCoordinates(place.y, place.x);
    field_coordinates.value = coordinates.latitude + "  " + coordinates.longitude;

    if (withDeleteButton) {
        buttonDeleteWrapper.classList.remove("retract");
    }
    showFields();
}
function candidateOnClick(place) {
    goToPoint(place);
    previewPlace = place;
	previewPlace.drawDot(true)
    setTimeout(() => {
        fillFields(place);
        clearSearchInput();
    }, 305);
}
function clearSearchInput() {
    inputSearch.value = "";
}
function showFields() {
    fields.classList.remove("onSearchResults");
    searchResults.classList.remove("onSearchResults");
    fields.classList.add("onFields");
    searchResults.classList.add("onFields");
}
function showSearchResults() {
    fields.classList.remove("onFields");
    searchResults.classList.remove("onFields");
    fields.classList.add("onSearchResults");
    searchResults.classList.add("onSearchResults");
    
}
function openMyPlaces() {
    tab.classList.add("retract");
    setTimeout(() => {
        myPlaces.classList.remove("retract");
    }, 135);
}
function closeMyPlaces() {
    myPlaces.classList.add("retract");
    setTimeout(() => {
        tab.classList.remove("retract");
    }, 195);
}
function raiseSearchBar() {
    formSearch.classList.add("formSearch_up");
    setTimeout(() => {
        divInformation.classList.add("open");
    }, 190);
}
function lowerSearchBar() {
    divInformation.classList.remove("open");
    setTimeout(() => {
        formSearch.classList.remove("formSearch_up");
    }, 200);
}
//#endregion

//#region Buttons
formSearch.onsubmit = (event)=> {
    event.preventDefault();
    let url = FIND_ADDRESS_CANDIDATES + inputSearch.value;
    httpGet(url, (r)=> {
        r = JSON.parse(r);
        if (r.candidates) {
			let places = parsePlaces(r.candidates);
            raiseSearchBar();
            setTimeout(() => {
                fillCandidates(places);
                fields.reset();
            }, 205);
        }
    })
}
fields.onsubmit = (event)=> {
    event.preventDefault();
    let fd = new FormData(fields);
    let name = fd.get("name");
    let address = fd.get("address");
    let phone = fd.get("phone");
    let category = fd.get("category");

    let coordinates = fd.get("coordinatesRaw").split(",");
    let place = new Place(name, address, phone, category, parseFloat(coordinates[0]), parseFloat(coordinates[1]));

    view.graphics.remove(previewPlace.point);
	savePlace(place);
    goToPoint(place);
    buttonDeleteWrapper.classList.remove("retract");
}
buttonDelete.onclick = ()=> {
    let coordinates = field_coordinatesRaw.value.split(",");
    let index = findSavedPlace(coordinates[0], coordinates[1]);
    savedPlaces[index].removePoint();                                   // Remove point from map
    myPlacesContainer.children[index].remove();                             // Remove from side menu
    savedPlaces.splice(index, 1);                                       // Remove from array
    localStorage.setItem("savedPlaces", JSON.stringify(savedPlaces));   // Save on ls
    lowerSearchBar();
}
//#endregion