from django.shortcuts import render
import json
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import requests
from math import sqrt
API_KEY = 'AIzaSyDlV7k3oGYKJwY08OnLadcte-SZ1ywBv_A'
from .data import d
import queue

# Create your views here.
def index(request):
    # render all route data as well
    context = {
        'data_json': json.dumps(d)  # Convert Python dict to JSON string
    }
    return render(request, "colombo/index.html", context)
"""
"""

@csrf_exempt
def get_directions(request):
    data = json.loads(request.body)
    frm = data['from']
    to = data['to']
    print(frm, to)
    from_location = geocode(frm)
    to_location = geocode(to)

    # option 1: check from A to B goog
    # opt1_duration = directions_request(from_location,  to_location)

    # find LA and LB by checking closest LRT
    from_lrt = get_closest_lrt(from_location)
    # print("closest to from", from_lrt)
    to_lrt = get_closest_lrt(to_location)
    # print("closest to to", to_lrt)

    #get dijkstram from from to to

    visited = {}
    prev = {}
    weight = {}
    q = queue.Queue()

    q.put(from_lrt["label"])
    weight[from_lrt["label"]] = 0
    prev[from_lrt["label"]] = ""

    while (not q.empty()):
        stop_label = q.get()
        stop = next((s for s in d['stops'] if s['label'] == stop_label), None)
        #print(stop)
        """
        """
        for n in stop["neighbours"]:
            if n != prev[stop_label]:
                n_stop = next((s for s in d['stops'] if s['label'] == n), None)
                if (("purpleL" in n_stop["lines"]) or ("greenL" in n_stop["lines"]) or ("redL" in n_stop["lines"])):
                    #print(n)
                    if n in weight:
                        if weight[n] > weight[stop_label] + 1:
                            weight[n] = weight[stop_label] + 1
                            prev[n] = stop_label
                            q.put(n)
                    else:
                        weight[n] = weight[stop_label] + 1
                        prev[n] = stop_label
                        q.put(n)


    # check from A to LA to LB to B using goog
    # check LA to LB using dijkstra
    # option 2: add to find A to B via LA nd LB
    # compare options 1 and 2
    # generate polylines as needed

    # Set the departure time (e.g., 2 hours from now)
    departure_time = (datetime.now() + timedelta(hours=2)).isoformat()

    # Create the dictionary that represents the structure
    sample_route = {
        "polylines": [

        ],
        "requests": [
            {
                "color": "pink",
                "data": {
                    "origin": location_to_str(to_lrt), 
                    "destination": location_to_str(to_location),
                    "travelMode": "TRANSIT",
                    "transitOptions": {
                        "departureTime": departure_time
                    }
                }
            },
            {
                "color": "green",
                "data": {
                    "origin": location_to_str(from_location),
                    "destination": location_to_str(from_lrt),
                    "travelMode": "TRANSIT",
                    "transitOptions": {
                        "arrivalTime": departure_time
                    }
                }
            }
        ]
    }

    sample_route["polylines"].insert(0, 
        {
            "name": "trainEast_data",
            "color": "#FEAE00",
            "coordinates": [ ]
        }   
    )

    forw = []

    s = to_lrt["label"]
    forw.insert(0, s)
    while (s in prev):
        print(s)
        sprev = prev[s]
        forw.insert(0, s)
        s = sprev

    prevline = None
    for i in range(len(forw) - 1):
        s_from = forw[i]
        s_to = forw[i+1]
        print("checking", s_from, "to", s_to)

        s_stop_from = next((st for st in d['stops'] if st['label'] == s_from), None)
        s_stop_to = next((st for st in d['stops'] if st['label'] == s_to), None)
        common_lines = list(set(s_stop_from["lines"]) & set(s_stop_to["lines"]))
        # print("list(set(s_stop_from['lines']): ", list(set(s_stop_from["lines"])))
        # print("list(set(s_stop_to['lines']): ", list(set(s_stop_to["lines"])))
              
        common_lines = [line for line in common_lines if line in ["redL", "greenL", "purpleL"]]
        print("commojn lines:", common_lines)
        c = None

        if (prevline != None and prevline in common_lines):
            c = prevline
        else:
            c = common_lines[0]
            
        print("c: ", c)

        for line in d["lines"]:
            if line["name"] == c:
                coordinates = line["coordinates"]
                strokeColor = line["strokeColor"]
        #print("coordinatess:", coordinates)

        start_index = -1
        end_index = -1

        # Loop through the coordinates to find the start and end indices
        for i, coord in enumerate(coordinates):
            if 'label' in coord:
                if coord['label'] == s_from:
                    start_index = i
                if coord['label'] == s_to:
                    end_index = i

        # If both start and end labels were found, return the subarray
        # Ensure both start and end labels were found
        if start_index != -1 and end_index != -1:
            # If the start comes before or at the same position as the end
            if start_index <= end_index:
                arr = coordinates[start_index:end_index + 1]
            else:
                # If the start comes after the end, reverse the subarray
                arr = coordinates[end_index:start_index + 1][::-1]
        else:
            # Handle the case where one or both labels are not found or are in the wrong order
            arr = []
        print("arr", arr)
        if c == prevline:
            sample_route["polylines"][-1]["coordinates"] = sample_route["polylines"][-1]["coordinates"] + arr
        else:
            sample_route["polylines"].append(
                {
                    "name": "trainEast_data",
                    "color": strokeColor,
                    "coordinates": arr,
                }   
            )
            prevline = c
        
    #print("sample_route", sample_route["polylines"])
    return JsonResponse(sample_route, status=200)

def location_to_str(location):
    return str(location['lat']) + ", " + str(location['lng'])

def directions_request(origin, destination):

    # Google Maps API key (replace with your actual API key)

    # Define the origin, destination, and departure time
    #origin = "6.914658472695419, 79.87756077875011"
    #destination = "Colombo, LK"
    departure_time = datetime.now() + timedelta(hours=2)  # Example: 2 hours from now

    # Convert the departure time to a UNIX timestamp (required by Google Maps API)
    departure_time_unix = int(departure_time.timestamp())

    # Prepare the URL for the Google Maps Directions API request
    url = f"https://maps.googleapis.com/maps/api/directions/json?origin={origin}&destination={destination}&mode=transit&departure_time={departure_time_unix}&key={API_KEY}"

    # Make the GET request
    response = requests.get(url)

    # Parse the response JSON
    data = response.json()

    # Check for a valid response and extract the duration
    if data['status'] == 'OK':
        # Extract the duration from the first route and first leg
        duration = data['routes'][0]['legs'][0]['duration']['text']
        print(f"Expected travel time: {duration}")
        return duration
    else:
        print(f"Error: {data['status']}")

def get_closest_lrt(location):
    lat = location['lat']
    lon = location['lng']

    closest_station = None
    min_distance = float('inf')  # Initialize with a large number
    station_lon = None
    station_lat = None
    label = None
    # Loop through all stations and calculate Euclidean distance
    for station in d["stops"]:
        if (("purpleL" in station["lines"]) or ("greenL" in station["lines"]) or ("redL" in station["lines"])):
            station_lat_temp = station['position']['lat']
            station_lon_temp = station['position']['lng']
            distance = euclidean_distance(lat, lon, station_lat_temp, station_lon_temp)
            
            if distance < min_distance:
                min_distance = distance
                closest_station = station
                station_lon = station_lon_temp
                station_lat = station_lat_temp
                label = station['label']

    print("closest station is", closest_station)
    return {
        'lat': station_lat,
        'lng': station_lon,
        'label': label
    }

# Function to calculate the Euclidean distance between two points
def euclidean_distance(lat1, lon1, lat2, lon2):
    return sqrt((lat2 - lat1)**2 + (lon2 - lon1)**2)

def geocode(address):
    # Your Google Maps API key
    # Geocoding API endpoint
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={address + ", LK"}&key={API_KEY}"

    # Send a GET request to the API
    response = requests.get(url)

    # Parse the JSON response
    data = response.json()

    # Check if the request was successful
    if data['status'] == 'OK':
        # Extract the latitude and longitude
        location = data['results'][0]['geometry']['location']
        latitude = location['lat']
        longitude = location['lng']
        
        print(f"Coordinates of '{location}':")
        print(f"Latitude: {latitude}, Longitude: {longitude}")
        return location
    else:
        print(address + f"Error: {data['status']}")