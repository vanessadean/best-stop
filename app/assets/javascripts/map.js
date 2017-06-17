var directionsDisplay,
    directionsService,
    directionsToRestaurant,
    directionsToDestination,
    map,
    marker,
    markers = [],
    select,
    stopPointLatLonObject,
    stopPointLat,
    stopPointLon;

$(function(){
  $("#directions-panel").hide();
  $("#instructions").hide();
  $("#stop_point_miles").hide();

  $("#method").change(function() {
    $("#stop_point_miles").hide();
    $("#stop_point_hours").hide();
    $( "#method option:selected" ).each(function() {
      select = "#stop_point_" + $(this).text();
    });
    $(select).show();
  })
  .trigger("change");
  //when user selects miles or hours the appropriate input box shows up

  $("#map_options").submit(function(event) {
    event.preventDefault();
    var origin = $("#start").val(),
        destination = $("#end").val();

    removeMarkers();

    calcRoute(origin, destination).then(function(result) {
      // when button is clicked the form and blurb are hidden and search again button appears
      $("#map_options").hide();
      $("#blurb").hide();
      $("#instructions").show();

      //info from form sent to restaurants controller
      $.ajax({
        url:'/restaurants/yelp_search',
        type: 'POST',
        data:(
          'lat=' + stopPointLat + '&' +
          'lon=' + stopPointLon + '&' +
          'type=' + $("#type").val() + '&' +
          'sort=' + $("#sort").val() + '&' +
          'mtd=' + $("#mtd").val()
         )
      });
    }, function(err) {
      console.log(err);
    });
  });

  $("#search_again_button").click(function(event){
    //form and blurb come back when search again button is clicked
    event.preventDefault();
    $("#map_options").show();
    $("#blurb").show();
    $("#directions-panel").hide();
    $("#instructions").hide();
    $(".searching").hide();

    createMap();
  });

  var mapOptions = {
    zoom: 6,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  map = new google.maps.Map(document.getElementById("map"), mapOptions);

  google.maps.event.addDomListener(window, "load", initialize);
});

function initialize() {
  directionsService = new google.maps.DirectionsService();
  directionsDisplay = new google.maps.DirectionsRenderer();

  createMap();
  autoComplete();
}

function createMap() {
  var origin = $("#start").val(),
      destination = $("#end").val();

  removeMarkers();

  if (directionsToRestaurant && directionsToDestination) {
    directionsToRestaurant.setMap(null);
    directionsToRestaurant = null;
    directionsToDestination.setMap(null);
    directionsToDestination = null;
  }

  calcRoute(origin, destination).then(function(result) {
    directionsDisplay.setMap(map);
  }, function(err) {
    console.log(err);
  });
}

function calcRoute(origin, destination) {
  return new Promise(function(resolve, reject) {
    var request = {
        origin:      origin,
        destination: destination,
        travelMode:  google.maps.TravelMode.DRIVING
    };
    //a request for driving directions is made to google maps using the start and end values from the form

    directionsService.route(request, function(response, status) {
      if (status == google.maps.DirectionsStatus.OK) {
        //if directions come back
        directionsDisplay.setDirections(response);
        //set the directions on the map using the response

        var method = $("#method").val();
        //users choice of hours or miles determines whether the stop point will be calculated the via distance or time method
        var stopPoint = parseInt($(select).val());
        //this is the value in either miles or or hours
        resolve(getStopPoint(response, stopPoint, method));
      } else {
        reject(Error("It broke"));
      }
    });
  });
}

function getStopPoint(response, stop, method) {
  var totalDist = response.routes[0].legs[0].distance.value,
      //pulls the total distance out of the JSON response sent back by google

      totalTime = response.routes[0].legs[0].duration.value,
      //pulls the total time out of the JSON response sent by google

      polyline = new google.maps.Polyline({
        path: [],
        //sets an empty path to start
        strokeColor: 'rgba(0,0,0,0)',
        strokeWeight: 1
      });

  var distance;
  var time;
  if (method == "hours") {
    distance = ((stop*3600)/totalTime) * totalDist;
    //takes the requested hours into the trip that the user wants to stop and converts that to the distance that must be traveled along the route to find the stop point
  } else if (method == "miles") {
    distance = stop*1609.34;
    //takes the miles in that the person wants to stop and converts it to meters
    time = ((stop/totalDist) * totalTime/60).toFixed(2);
  }
  if (distance > totalDist) {
    alert("Your trip will take about " + (totalTime/3600).toFixed(0) + " hours to travel " + (totalDist*0.000621371).toFixed(0) + " miles. Please chose a stopping point within that time frame or distance.");
  }
  //alert in case the user tries to pick a stopping point outside the bounds of the trip

  var bounds = new google.maps.LatLngBounds();
  //set the bounds of the map

  var steps = response.routes[0].legs[0].steps;
  //determines number of steps in the route

  steps.forEach(function(step) {
    //iterates through each step in the route
    var paths = step.path;
    //gets the paths for each segment
    paths.forEach(function(path) {
      //iterates through each portion of the path
      //path is split up into segments designated by lat lon
      polyline.getPath().push(path);
      //pushes each portion of the path onto polyline path
      bounds.extend(path);
      //increase bounds to encompass entire route
    });
  });

  stopPointLatLonObject = polyline.GetPointAtDistance(distance);
  //uses epoly function to determine the appropriate stop point along the route given the distance calculated from user's choice (in miles or hours)
  marker = new google.maps.Marker({
    position: stopPointLatLonObject,
    map: map
  });
  markers.push(marker);
  //places marker at stop point

  stopPointLat = stopPointLatLonObject.lat();
  stopPointLon = stopPointLatLonObject.lng();
}

function placeRestaurantMarkers(restaurants) {
  var infowindow = new google.maps.InfoWindow();
  //sets up a new info window object

  var icon = "http://maps.google.com/mapfiles/ms/icons/purple-dot.png";
  //sets pins to the purple icon

  stopPointLat = stopPointLatLonObject.lat();
  stopPointLon = stopPointLatLonObject.lng();
  var bounds = new google.maps.LatLngBounds({ lat: stopPointLat, lng: stopPointLon});
  //sets the center of map bounds based on the stopping point

  restaurants.forEach(function(restaurant, i) {
    //iterates through the list of restaurant options

    var position = { lat: restaurant[0], lng:  restaurant[1] };
    //determines position for pin based on restaurant lat/lon

    marker = new google.maps.Marker({
      position: position,
      map: map,
      icon: icon
    });
    //places new google marker onto map in that position

    bounds.extend(new google.maps.LatLng(position));
    // //extends bounds of the map to display the pin
    map.fitBounds(bounds);
    // //fits the map to those bounds
    // //acts as a zoom

    //sets click listener for marker
    google.maps.event.addListener(marker, 'mouseover', (function(marker, i) {
      //on hover...
      return function() {
        var info = setInfoContent(restaurant);
        infowindow.setContent(info);
        //content of info window is set
        infowindow.open(map, marker);
        //info window pops up
      }
    })(marker, i));
    google.maps.event.addListener(marker, 'click', (function(marker, i) {
      //when clicked...
      return function() {
        $("#directions-panel").show();
        restaurantDirections(restaurants[i][6]);
        //directions to and from the restaurant are listed and displayed on the map
      }
    })(marker, i));
    markers.push(marker);
  });
  $(".searching").hide();
  $("#search_again").show();
}

//Info being passed in via 'restaurants'
//0<%= restaurant.latitude %>, 1<%= restaurant.longitude %>, 2'<%= restaurant.name %>', 3'<%= restaurant.image_url %>', 4<%= restaurant.rating %>, 5'<%= restaurant.rating_img_url %>', 6'<%= restaurant.address %>', 7'<%= restaurant.url %>'
function setInfoContent(restaurant) {
  var string = `<div class="infowindow"><div class="row"><div class="col-xs-3"><img src="${ restaurant[3]}"></div><div class="col-xs-8 col-xs-offset-1"><p><strong>${restaurant[2]}</strong></p><p>Rating: <img src="${restaurant[5]}"></p><p>${restaurant[6]}</p><p><a href="${restaurant[7]}" target="_blank">More Info</a></p></div></div></div>`
  return string;
}

function restaurantDirections(restaurant){
  if(directionsToRestaurant != null){
    directionsToRestaurant.setMap(null);
    directionsToRestaurant = null;
  }
  if(directionsToDestination != null){
    directionsToDestination.setMap(null);
    directionsToDestination = null;
  }
  //deletes any previous routes on the map

  $("#directions-panel").html("");
  //deletes previous directions displayed on the screen

  var start = $("#start").val(),
      end = $("#end").val();
  //sets start and finish values

  //set route info from start to chosen restaurant
  var route_1 = {
      origin: start,
      destination: restaurant,
      travelMode: google.maps.TravelMode.DRIVING
   };
  //sends route info to google and receives directions
  directionsService.route(route_1, function(response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      directionsToRestaurant.setDirections(response);
    }
  });

  //set route info from selected restaurant to destination
  var route_2 = {
      origin: restaurant,
      destination: end,
      travelMode: google.maps.TravelMode.DRIVING
  };
  //sends route info to google and receives directions
  directionsService.route(route_2, function(response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      directionsToDestination.setDirections(response);
    }
  });

  //displays route to restaurant on map
  directionsToRestaurant = new google.maps.DirectionsRenderer({
    map : map,
    preserveViewport: true,
    suppressMarkers : true,
    polylineOptions : { strokeColor:'purple',
                        strokeOpacity: .5,
                        strokeWeight: 4
                      }
   });
  //displays route from restaurant to destination on map
  directionsToDestination = new google.maps.DirectionsRenderer({
    map : map,
    preserveViewport: true,
    suppressMarkers : true,
    polylineOptions : { strokeColor:'blue',
                        strokeOpacity: .7,
                        strokeWeight: 4
                      }
   });

  //set panel displays with step-by-step directions
  var directionsPanel = document.getElementById('directions-panel');
  directionsToRestaurant.setPanel(directionsPanel);
  directionsToDestination.setPanel(directionsPanel);
}

function removeMarkers() {
  markers.forEach(function(marker) {
    marker.setMap(null);
  });
}

function autoComplete() {
  new google.maps.places.Autocomplete(document.getElementById('start'));
  new google.maps.places.Autocomplete(document.getElementById('end'));
}
