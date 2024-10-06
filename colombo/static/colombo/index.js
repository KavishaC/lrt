var map;
const numPoints = 100;

// Catmull-Rom spline interpolation
function catmullRomSpline(P0, P1, P2, P3, t) {
    const t2 = t * t;
    const t3 = t2 * t;

    const x = 0.5 * ((2 * P1.lat) + (-P0.lat + P2.lat) * t + (2 * P0.lat - 5 * P1.lat + 4 * P2.lat - P3.lat) * t2 + (-P0.lat + 3 * P1.lat - 3 * P2.lat + P3.lat) * t3);
    const y = 0.5 * ((2 * P1.lng) + (-P0.lng + P2.lng) * t + (2 * P0.lng - 5 * P1.lng + 4 * P2.lng - P3.lng) * t2 + (-P0.lng + 3 * P1.lng - 3 * P2.lng + P3.lng) * t3);

    return { lat: x, lng: y };
}

// Function to generate Catmull-Rom spline curve points
function generateCatmullRomCurve(points, numPoints) {
    const curvePoints = [];

    // Ensure the start point is included
    curvePoints.push(points[0]);

    // Generate spline points between P1 and Pn-1
    for (let i = 1; i < points.length - 2; i++) {
        const P0 = points[i - 1];
        const P1 = points[i];
        const P2 = points[i + 1];
        const P3 = points[i + 2];

        for (let t = 0; t <= 1; t += (1 / numPoints)) {
            curvePoints.push(catmullRomSpline(P0, P1, P2, P3, t));
        }
    }

    // Ensure the end point is included
    curvePoints.push(points[points.length - 1]);

    return curvePoints;
}

function initMap() {
    // Create the map
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 6.9, lng: 79.877 },
        zoom: 14,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }] // Hide POI labels
            },
            {
                featureType: "road",
                elementType: "labels",
                stylers: [{ visibility: "off" }] // Turn off all road labels
            },
            {
                featureType: "transit.station.rail",  // If rail didn't work, target all transit stations
                elementType: "labels",  // Target the labels (names)
                stylers: [{ visibility: "off" }]  // Hide station names for all transit types
            },
            {
                featureType: "transit.station",  // If rail didn't work, target all transit stations
                elementType: "labels",  // Target the labels (names)
                stylers: [{ visibility: "off" }]  // Hide station names for all transit types
            },
            {
                featureType: "administrative.neighborhood",
                elementType: "labels",
                stylers: [{ visibility: "off" }] // Hide small suburb/neighborhood names
            },
            {
                featureType: "road", // Target all road types
                elementType: "geometry", // Target the geometry of the roads (lines)
                stylers: [
                    { color: "#ffffff" },  // Set all roads to white
                    { visibility: "simplified" }  // Simplified to avoid extra details
                ]
            },
        ]
    });

    for (const route of data.lines) {
        const line = new google.maps.Polyline({
            path: generateCatmullRomCurve(route['coordinates'], numPoints),
            strokeColor: route['strokeColor'],
            geodesic: true,
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
        line.setMap(map);
    }

    // Example points with labels

    const markers = data.stops.map(point => addCustomMarker(map, point)); // Now 'markers' is an array of { markerDiv, circleIcon }
    const zoomThreshold = 13;

    // Listen for zoom changes to show/hide labels
    map.addListener('zoom_changed', () => {
        const zoomLevel = map.getZoom();

        markers.forEach((markerDiv) => { // Destructure each { markerDiv, circleIcon } from the array
            if (zoomLevel >= zoomThreshold) {
                markerDiv.style.display = 'flex'; // Show label
                //circleIcon.setMap(map);
                // If circleIcon is a DOM element that needs to be shown/hidden, otherwise you can omit this
            } else {
                markerDiv.style.display = 'none'; // Hide label
                //circleIcon.setMap(null); // Show label
            }
        });
    });
    //sample_directions(map);
    autocomplete(map);
}

// Helper function to calculate the rotated point
function rotatePoint(center, point, angle) {
    const angleRad = angle * (Math.PI / 180); // Convert angle to radians
    const sinAngle = Math.sin(angleRad);
    const cosAngle = Math.cos(angleRad);

    const latDiff = point.lat - center.lat;
    const lngDiff = point.lng - center.lng;

    const newLat = center.lat + (latDiff * cosAngle - lngDiff * sinAngle);
    const newLng = center.lng + (latDiff * sinAngle + lngDiff * cosAngle);

    return { lat: newLat, lng: newLng };
}

// Function to add a custom marker with HTML label
function addCustomMarker(map, point) {
    // Define a custom icon as a circle using SVG
    const circleIcon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 2, // Adjust size
        fillColor: '#FFFFFF', // Circle color
        fillOpacity: 1.0,
        strokeWeight: 1, // Circle border thickness
        strokeColor: '#AAAAAA' // Circle border color
    };
    /*
    */
    const marker = new google.maps.Marker({
        position: point.position,
        map: map,
        icon: circleIcon, // Set the custom circle icon
    });

    if (point.lines.includes("redL") || point.lines.includes("greenL") || point.lines.includes("purpleL")) {
        const latLng = point.position; // Center position of the rectangle
        const widthInDegrees = 0.00015; // Adjust the size of the rectangle (latitude difference)
        const heightInDegrees = 0.0003; // Adjust the size of the rectangle (longitude difference)
        let angle = 90;
        if ("angle" in point) {
            angle = point.angle; // Rotation angle in degrees
        }
        
        // Calculate the four corners of the unrotated rectangle
        const halfWidth = widthInDegrees / 2;
        const halfHeight = heightInDegrees / 2;
        
        const corners = [
            { lat: latLng.lat + halfHeight, lng: latLng.lng + halfWidth }, // Top-right
            { lat: latLng.lat + halfHeight, lng: latLng.lng - halfWidth }, // Top-left
            { lat: latLng.lat - halfHeight, lng: latLng.lng - halfWidth }, // Bottom-left
            { lat: latLng.lat - halfHeight, lng: latLng.lng + halfWidth }, // Bottom-right
        ];
        
        // Rotate each corner around the center point
        const rotatedCorners = corners.map(corner => rotatePoint(latLng, corner, angle));
        
        // Create a polygon representing the rotated rectangle
        const rectanglePolygon = new google.maps.Polygon({
            paths: rotatedCorners,
            map: map, // Your map instance
            fillColor: '#FF0000', // Optional: Set the fill color
            fillOpacity: 0.35, // Optional: Set the fill opacity
            strokeColor: '#FF0000', // Optional: Set the stroke color
            strokeOpacity: 0.8, // Optional: Set the stroke opacity
            strokeWeight: 2, // Optional: Set the stroke width
        });
        const halfWidth2 = halfWidth / 2;

        const corners2 = [
            { lat: latLng.lat + halfHeight, lng: latLng.lng + halfWidth2 }, // Top-right
            { lat: latLng.lat + halfHeight, lng: latLng.lng - halfWidth2 }, // Top-left
            { lat: latLng.lat - halfHeight, lng: latLng.lng - halfWidth2 }, // Bottom-left
            { lat: latLng.lat - halfHeight, lng: latLng.lng + halfWidth2 }, // Bottom-right
        ];
        
        // Rotate each corner around the center point
        const rotatedCorners2 = corners2.map(corner => rotatePoint(latLng, corner, angle));
        
        // Create a polygon representing the rotated rectangle
        const rectanglePolygon2 = new google.maps.Polygon({
            paths: rotatedCorners2,
            map: map, // Your map instance
            fillColor: '#FFFFFF', // Optional: Set the fill color
            fillOpacity: 0.35, // Optional: Set the fill opacity
            strokeColor: '#FF0000', // Optional: Set the stroke color
            strokeOpacity: 0.8, // Optional: Set the stroke opacity
            strokeWeight: 2, // Optional: Set the stroke width
        });
    }

    const markerDiv = document.createElement('div');
    markerDiv.className = 'custom-marker-label';
    //markerDiv.textContent = point.label; // Custom label text
    markerDiv.style.display = 'flex';
    markerDiv.style.flexDirection = 'column'; // Stack image and text vertically
    markerDiv.style.position = 'absolute'; // Make sure i

    // Create a container for the images
    const imageContainer = document.createElement('div');
    imageContainer.style.display = 'flex';
    //imageContainer.style.justifyContent = 'center'; // Center the images
    imageContainer.style.marginBottom = '1px'; // Add some space between the images and text

    // Create two img elements for the small images
    
    for (const line of point.lines) {
        const imageElement = document.createElement('img');
        if (lines[line]) {
            imageElement.src = lines[line];
        } else {
            console.error(`No image found for line: ${line}`);
        }
        imageElement.style.width = '13px'; // Adjust size as needed
        imageElement.style.height = '13px';
        imageElement.style.marginRight = '1px'; // Add some space between the two images
        imageContainer.appendChild(imageElement); // Append each image to the container
    }

    // Create a span element for the custom label text
    const labelText = document.createElement('span');
    labelText.textContent = point.label; // Custom label text

    // Append the imageContainer and labelText to the markerDiv
    markerDiv.appendChild(imageContainer);
    markerDiv.appendChild(labelText);

    // Create an overlay to place the custom marker
    const overlay = new google.maps.OverlayView();
    overlay.onAdd = function () {
        const layer = this.getPanes().overlayLayer;
        layer.appendChild(markerDiv);

        const projection = this.getProjection();
        const position = projection.fromLatLngToDivPixel(point.position);

        // Position the custom label near the marker
        markerDiv.style.left = `${position.x - 15}px`;
        markerDiv.style.top = `${position.y}px`;
    };

    // Update label position when the map moves
    overlay.draw = function () {
        const projection = this.getProjection();
        const position = projection.fromLatLngToDivPixel(point.position);

        markerDiv.style.left = `${position.x - 15}px`;
        markerDiv.style.top = `${position.y - markerDiv.offsetHeight / 2}px`;
    };
    overlay.setMap(map);
    return markerDiv;
}

document.addEventListener('DOMContentLoaded', function () {
    initMap();
})

function handleSearchSubmit(event) {
    // Prevent the default form submission (page reload)
    event.preventDefault();

    // Assume `map` is globally available or passed in some way
    get_directions(map);
}

function get_directions(map) {

    var from = document.getElementById("from").value;
    var to = document.getElementById("to").value;

    fetch('get_directions', {
        method: 'POST',
        body: JSON.stringify({
            from: from,
            to: to,
        })
    })
        .then(response => response.json())
        .then(result => {
            console.log(result)
            document.getElementById("directions-card").style.display = 'block';
            plot_directions(map, result);

        })
}
// Array to store all renderers
var renderers = [];
let polylines = [];

function plot_directions(map, data) {
    for (let i = 0; i < renderers.length; i++) {
        renderers[i].setMap(null);  // Remove the renderer from the map
    }
    renderers = [];  // Clear the renderers array

    // map route requests
    var directionsService = new google.maps.DirectionsService();

    var now = new Date();
    var departureTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0, 0);

    for (const request of data.requests) {
        let renderer = new google.maps.DirectionsRenderer({
            map: map,
            preserveViewport: true,  // Prevent the map from moving or zooming
            //polylineOptions: {
            //strokeColor: request.color,  // Set the color of the first route
            //strokeWeight: 5,
            //}
        });

        if (request.data.transitOptions && request.data.transitOptions.departureTime) {
            request.data.transitOptions.departureTime = new Date(request.data.transitOptions.departureTime);
        }

        if (request.data.transitOptions && request.data.transitOptions.arrivalTime) {
            request.data.transitOptions.arrivalTime = new Date(request.data.transitOptions.arrivalTime);
        }

        // Route calculation and rendering for the first route
        directionsService.route(request.data, function (result, status) {
            if (status === 'OK') {
                renderer.setDirections(result);  // Render first route on the map
                renderers.push(renderer);
                // Extract the duration information from the response
                var route = result.routes[0];
                var leg = route.legs[0];
                var duration = leg.duration.text; // Expected travel time in human-readable format

                // Display the duration in a div
                document.getElementById('duration').innerHTML = duration;
            } else {
                console.error('Directions request failed for first route due to ' + status);
            }
        });
    }

    // plot polylines
    for (const line of polylines) {
        line.setMap(null);  // Remove the polyline from the map
    }
    polylines = [];  // Clear the array

    for (const route of data.polylines) {
        const line = new google.maps.Polyline({
            path: generateCatmullRomCurve(route['coordinates'], numPoints),
            strokeColor: route['color'],
            geodesic: true,
            strokeOpacity: 1.0,
            strokeWeight: 6
        });
        line.setMap(map);
        polylines.push(line);  // Store the polyline in the array
    }
}

function autocomplete(map) {
    // Create the autocomplete object, restricting the search to geographical location types.
    var autocomplete = new google.maps.places.Autocomplete(
        document.getElementById('from'),
        { types: ['geocode'] } // Restrict to geographical results
    );

    // Bind the map to the Autocomplete object for better experience.
    autocomplete.bindTo('bounds', map);

    // Set up a marker for the chosen location.
    var marker = new google.maps.Marker({
        map: map
    });

    // Listen for place changes on the autocomplete input.
    autocomplete.addListener('place_changed', function () {
        var place = autocomplete.getPlace();
        if (!place.geometry) {
            console.log("No details available for the input: '" + place.name + "'");
            return;
        }

        // If the place has a geometry, then present it on the map.
        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17); // Zoom when a location is selected
        }

        // Place the marker at the location
        marker.setPosition(place.geometry.location);
        marker.setVisible(true);
    });
}

sampleroute = {
    polylines: [
        {
            name: 'trainEast_data',
            strokeColor: '#22788c',
            coordinates: [
                { lat: 6.929769071288821, lng: 79.86475961853324 }, //label: "Maradana", lines: ['redL', 'train', 'bus'] },
                { lat: 6.93252867065419, lng: 79.87387449238345 },
                { lat: 6.92658915384532, lng: 79.87822236192157 }, //label: "Mount Mary" , lines: ['greenL', 'train', 'bus'] },
            ]
        },
    ],
    requests: [
        {
            color: 'pink',
            data: {
                origin: '6.929769071288821 79.86475961853324',  // Start location
                destination: 'Fort, Colombo, LK',  // End location
                travelMode: 'TRANSIT',
                transitOptions: {
                    departureTime: departureTime // Arrive in 2 hours
                }  // Mode of travel: DRIVING, WALKING, BICYCLING, or TRANSIT
            },
        }, {
            color: 'green',
            data: {
                origin: 'Fife Road, Colombo, LK',  // Start location
                destination: '6.92658915384532, 79.87822236192157',  // End location
                travelMode: 'TRANSIT',
                transitOptions: {
                    arrivalTime: departureTime // Arrive in 2 hours
                }  // Mode of travel: DRIVING, WALKING, BICYCLING, or TRANSIT
            },
        }
    ]
}