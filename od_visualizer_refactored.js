// Create the Leaflet map and add a Mapbox tile layer
var map = L.map("map");
L.tileLayer( // someday I should replace this with my own Mapbox API key
  "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw",
  {
    maxZoom: 18,
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
      'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: "mapbox/light-v9",
    tileSize: 512,
    zoomOffset: -1,
  }
).addTo(map);

// Create a couple functions for handling the color ramp
var nullColor = 'lightgray';
var colors = colorbrewer.GnBu[7];

// A seven-bucket threshold scale, roughly equivalent to a log-quantize scale
// i.e. 3 is close to 3.162 == 10^0.5
var threshold = d3.scaleThreshold()
    .domain([0.001, 0.003, 0.01, 0.03, 0.1, 0.3])
    .range(colors);

// Create and add a legend
var legend = L.control({position: 'bottomright'});
legend.onAdd = function(map) {
  var div = L.DomUtil.create('div', 'info legend'),
      labels = ['<0.1%', '0.1&ndash;0.3%', '0.3&ndash;1.0%', '1&ndash;3%', '3&ndash;10%', '10&ndash;30%', '>30%'];

  div.innerHTML = `<h4>Share of Total Trips</h4><i style="background:${nullColor}"></i> No trips`;
  labels.forEach((label, i) => {
    div.innerHTML += `<br><i style="background:${colors[i]}"></i> ${label}`
  });
  return div;
};
legend.addTo(map);

// define an array of parameters to be used to populate the drop-down menus
var optionSets = [{ mapFunc: d => d.o_name,
                    selectString: '#zone',
                    textFunc: d => d + ' County',
                    valueFunc: d => d },
                  { mapFunc: d => d.year,
                    selectString: '#year',
                    textFunc: d => d,
                    valueFunc: d => d },
                  ];

var params; // instantiate this now; we will populate it once the CSV loads
// define criteria for filtering the flows table
function filterCriteria(d, filterKey) {
  return (d[filterKey] === params.zone) && (d.year === params.year);
}

//// Prepare the GeoJSON data for drawing on the Leaflet map
//// (we won't actually draw it until we finish loading the CSV data,
//// because an early call to handleClick() would fail).

// create an initial style in which to draw the polygons
function style(feature) {
  return {
    weight: 1.25,
    opacity: 1,
    color: 'black',
    fillOpacity: 0.7,
    fillColor: nullColor,
  };
}

function handleClick(e) {
  // first remove any highlighting that may already be present
  geojson.resetStyle();
  let layer = e.target;

  layer.setStyle({
    weight: 4,
    color: "#f3c722"
  });
  layer.bringToFront();

  let zone = e.target.feature.id;
  // set the zone drop-down to the id of the just-clicked polygon
  document.getElementById('zone').value = zone;
  params.zone = zone;
  refreshMap();
}

function onEachFeature(feature, layer) {
  layer.on({
    click: handleClick,
  });
  // set a couple of important properties based on the GeoJSON NAME
  feature.id = feature.properties.NAME;
  layer._leaflet_id = feature.id;
}

var geojson = L.geoJson(caCounties, {
  style: style,
  onEachFeature: onEachFeature,
});
// we could bind tooltips within onEachFeature, but doing it here lets us unbind (and therefore modify) them later
geojson.bindTooltip(layer => `<b>${layer.feature.id} County</b>`, { sticky: true });

// Create an event handler...
function handleSelectChange(e) {
  if (e.target.id === 'zone') {
    // The easiest way to handle a change to the zone dropdown is to simulate a click on the corresponding polygon
    if (e.target.value === 'none') { // bit we need to handle the special case where '[select a zone]' is selected
      geojson.resetStyle();
      return;
    }
    geojson.getLayer(e.target.value).fire('click'); 
  } else {
    // Store the just-changed selection in params
    params[e.target.id] = e.target.value;
    refreshMap();
  }
}

//Read the data
var data;
d3.csv('flows.csv').then(function(csvData) {
  optionSets.forEach(function(optionSet) {
    // Use Array.map to extract specific attributes, Set to remove duplicate values,
    // and the spread operator to expand the set back into an Array which we then sort.
    // The result is a sorted array of unique values.
    let options = [...new Set(csvData.map(optionSet.mapFunc))].sort();

    // add options to drop-down
    d3.select(optionSet.selectString)
      .selectAll("d3Option") // none will exist yet; this creates the options! if I'd used "option", that would not add all the new options, just the ones whose indices exceed the current number of options
        .data(options)
      .enter()
      .append("option")
        .text(optionSet.textFunc) // text shown in the menu
        .attr("value", optionSet.valueFunc); // corresponding value returned by the select
  });

  // Store the current values of the various drop-downs in an Object named params
  var selects = document.querySelectorAll('select'); // we will use this again later
  params = Object.fromEntries([...selects].map(x => [x.id, x.value]));

  // ...and add it to each drop-down select element
  selects.forEach( item => {
    item.addEventListener('change', handleSelectChange);
  });

  geojson.addTo(map);
  map.fitBounds(geojson.getBounds());

  data = csvData;
  }
);

var noDecimals = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
var percent = { style: 'percent', maximumSignificantDigits: 3 };

// One big function that runs whenever the map is clicked or a drop-down changes
function refreshMap() {
  // Set search keys according to the direction of interest
  if (params.direction === 'inbound') {
    var featureKey = 'o_name';
    var filterKey = 'd_name';
  } else if (params.direction === 'outbound') { // these are the only two values for now, but in future there could be others, hence I handle each explicitly
    var featureKey = 'd_name';
    var filterKey = 'o_name';
  }

  // Filter the flows table to only relevant rows
  var currentData = data.filter(d => filterCriteria(d, filterKey));

  // Calculate total volume for all relevant rows
  let totalVol = currentData.reduce((a, b) => a + +b.vol, 0);

  // Convert this array into an Object for high-performance lookups from within Leaflet
  var currentValues = Object.fromEntries(currentData.map(x => [x[featureKey], { vol: +x.vol, pct: +x.vol / totalVol}]));

  // Populate each GeoJSON feature with a value property.
  // Features not in the object will have value == undefined, which we use later
  caCounties.features = caCounties.features.map(function(feature) {
    if (currentValues[feature.id]) {
      feature.vol = currentValues[feature.id].vol; 
      feature.pct = currentValues[feature.id].pct;
    } else {
      feature.vol = 0;
      feature.pct = 0;
    }
    return feature;
  });

  function getColor(feature) {
    if (feature.pct === 0) {
      return nullColor;
    } else {
      return threshold(feature.pct);
    }
  }

  function mapStyle(feature) {
    return { fillColor: getColor(feature) };
  }

  geojson.setStyle(mapStyle);
  // geojson.setStyle(feature => { fillColor: getColor(feature) }); // why doesn't this work??

  geojson.unbindTooltip();
  geojson.bindTooltip(layer => `<b>${layer._leaflet_id} County</b><br>
    ${layer.feature.vol.toLocaleString(undefined, noDecimals)} trips
    (${layer.feature.pct.toLocaleString(undefined, percent)} of total)`, { sticky: true });
}