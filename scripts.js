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
const buttonCloseMyPlaces = document.getElementById("buttonCloseMyPlaces");
//#endregion

//#region Data
let apiKey = "AAPK1b41e6e295d842e0a87bbc29e2983a50XNkG_CzPx4GE-wTKJMcU_xgykDl645pD4XOFgKFig5kgY4TMYdFjwI6etgL1rfF4";
const colors = Object.freeze([
    [150, 0, 20],		// 0, Comercial, red
    [30, 10, 160],		// 1, Residencial, blue
    [110, 0, 110],		// 2, Mixta, purple
]);
function truncate(float) {
	return Math.round((float + Number.EPSILON) * 10000) / 10000
}
class Place {
	constructor(name, address, phone, category, y, x) {
		this.name = name;
		this.address = address;
		this.phone = phone;
		this.category = category;
		this.y = y;
		this.x = x;
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
let places = [];
function savePlace(place) {
	places.push(place);
	localStorage.setItem("places", JSON.stringify(places));
	let fragment = document.createDocumentFragment();
	let div = document.createElement("div");
	div.classList.add("searchResult");
	div.onclick = ()=> {
		console.log("my place on click");
	}
	let p1 = document.createElement("p");
	p1.innerHTML = place.name;
	let p2 = document.createElement("p");
	p2.innerHTML = place.address;
	div.appendChild(p1)
	div.appendChild(p2);
	fragment.appendChild(div);
	myPlaces.append(fragment);
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
let map, view, previewPoint;
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
	addDots([place], true);
}
function addDots(places, preview = false) {
    require(["esri/Graphic"], (Graphic)=> {

		for (let f = 0; f < places.length; f++) {
			let x = truncate(places[f].x);
			let y = truncate(places[f].y);
		
			const pointGeometry = {
				type: "point",
				longitude: x,
				latitude: y
			};
		
			const markerSymbol = {
				type: "simple-marker",
				color: preview ? [190, 194, 201] : colors[places[f].category],
				outline: {
					color: [255, 255, 255],
					width: 2
				}
			};
		
			let attributes = {
				Direccion: places[f].address,
				Telefono: places[f].phone,
				Categoria: places[f].category,
				Latitud: y,
				Longitud: x
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
			if (places[f].category) popupTemplate.content[0].fieldInfos.unshift({fieldName: "Categoria"});
			if (places[f].phone) popupTemplate.content[0].fieldInfos.unshift({fieldName: "Telefono"});
			if (places[f].name) {
				popupTemplate.title = places[f].name;
				popupTemplate.content[0].fieldInfos.unshift({fieldName: "Direccion"});
			} else {
				popupTemplate.title = places[f].address;
			}
		
			if (preview) {
				previewPoint = new Graphic({
					geometry: pointGeometry,
					symbol: markerSymbol,
					attributes: attributes,
					popupTemplate: popupTemplate
				});
			
				view.graphics.add(previewPoint);
			} else {
				let point = new Graphic({
					geometry: pointGeometry,
					symbol: markerSymbol,
					attributes: attributes,
					popupTemplate: popupTemplate
				});
				console.log(point);
				view.graphics.add(point);
			}
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
    searchResults.appendChild(fragment);
}
function fillFields(place) {
    field_name.value = place.name;
    field_address.value = place.address;
    field_phone.value = place.phone;
    field_category.value = place.category;
	console.warn(field_category.value);
    field_coordinatesRaw.value = place.y + "," + place.x;
    let sCoordinates = "";

    sCoordinates += (Math.abs(place.y) + "º ");
    if (place.y < 0)
        sCoordinates += "S";
    else
        sCoordinates += "N";
    sCoordinates += (", " + Math.abs(place.x) + "º ");
    if (place.x < 0)
        sCoordinates += "W";
    else
        sCoordinates += "E";

    showFields();
    field_coordinates.value = sCoordinates;
}
function candidateOnClick(place) {
    goToPoint(place);
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
//#endregion

//#region Buttons
formSearch.onsubmit = (event)=> {
    event.preventDefault();
    fields.reset();
    let url = FIND_ADDRESS_CANDIDATES + inputSearch.value;
    httpGet(url, (r)=> {
        r = JSON.parse(r);
        if (r.candidates) {
			let places = parsePlaces(r.candidates);
            formSearch.classList.add("formSearch_up");
            divInformation.classList.add("open");
            setTimeout(() => {
                fillCandidates(places);
            }, 205);
        }
    })
}
tab.onclick = openMyPlaces;
buttonCloseMyPlaces.onclick = closeMyPlaces;
fields.onsubmit = (event)=> {
    event.preventDefault();
    let fd = new FormData(fields);
    let name = fd.get("name");
    let address = fd.get("address");
    let phone = fd.get("phone");
    let category = fd.get("category");
	console.log(category);
    let coordinates = fd.get("coordinatesRaw").split(",");
    let place = new Place(name, address, phone, category, parseFloat(coordinates[0]), parseFloat(coordinates[1]));
	console.log(place);
    view.graphics.remove(previewPoint);
    addDots([place]);
	savePlace(place);
}
//#endregion