var map = L.map("map");

L.tileLayer(
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

var colors;
var nullColor = 'lightgray';

//Read the data
d3.csv('flows.csv').then(function(data) {
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

  // define criteria for filtering the flows table
  function filterCriteria(d, filterKey) {
    return (d[filterKey] === params.zone) && (d.year === params.year);
  }
  
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
    let zone = e.target.feature.properties.NAME;
    document.getElementById('zone').value = zone;
    params.zone = zone;
    refreshMap();
  }

  function onEachFeature(feature, layer) {
    layer.on({
      click: handleClick,
    });
    layer.bindTooltip(feature.properties.NAME, { sticky: true });
  }

  var geojson = L.geoJson(caCounties, {
    style: style,
    onEachFeature: onEachFeature,
  }).addTo(map);

  map.fitBounds(geojson.getBounds());

  var legend = L.control({position: 'bottomright'});
  legend.onAdd = function(map) {
    this._div = L.DomUtil.create('div', 'info legend');
    this.update();
    return this._div;
  };

  let noDecimals = { minimumFractionDigits: 0, maximumFractionDigits: 0 };

  legend.update = function(grades) {
    this._div.innerHTML = `<h4>Trips</h4><i style="background:${nullColor}"></i> 0`;
    if (grades) {
      for (var i = 0; i < grades.length - 1; i++) { // grades.length - 1 because I'm going to pass it a grades array 1 longer than colors (so I can show the top value)
        this._div.innerHTML += `<br><i style="background:${colors[i]}"></i> 
        ${grades[i].toLocaleString(undefined, noDecimals)}&ndash;${grades[i + 1].toLocaleString(undefined, noDecimals)}`;
      }
    }
  };

  legend.addTo(map);

  optionSets.forEach(function(optionSet) {
    // Use Array.map to extract specific attributes, Set to remove duplicate values,
    // and the spread operator to expand the set back into an Array which we then sort.
    // The result is a sorted array of unique values.
    let options = [...new Set(data.map(optionSet.mapFunc))].sort();

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
  var params = Object.fromEntries([...selects].map(x => [x.id, x.value]));

  // Create an event handler...
  function handleSelectChange(e) {
    // Store the just-changed selection in params
    params[e.target.id] = e.target.value;
    refreshMap();
  }
  // ...and add it to each drop-down select element
  selects.forEach( item => {
    item.addEventListener('change', handleSelectChange);
  });
  
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

    // Convert this array into an Object for high-performance lookups from within Leaflet
    var currentValues = Object.fromEntries(currentData.map(x => [x[featureKey], +x.vol]));

    // Populate each GeoJSON feature with a value property.
    // Features not in the object will have value == undefined, which we use later
    caCounties.features = caCounties.features.map(function(feature) {
      feature.value = currentValues[feature.properties.NAME]; 
      return feature;
    });

    // make sure we don't have more buckets than observations
    colors = colorbrewer.GnBu[Math.min(currentData.length, 7)];

    // Create a quantile color scale based on the relevant rows
    var quantile = d3.scaleQuantile()
        .domain(Object.values(currentValues))
        .range(colors);

    let grades = [Math.min(...quantile.domain()), 
      ...quantile.quantiles(), 
      Math.max(...quantile.domain())];

    function getColor(feature) {
      if (feature.value === undefined) {
        return nullColor;
      } else {
        return quantile(feature.value);
      }
    }

    function mapStyle(feature) {
      return { fillColor: getColor(feature) };
    }

    geojson.setStyle(mapStyle);
    // geojson.setStyle(feature => { fillColor: getColor(feature) }); // why doesn't this work??



    // console.log(grades);

    legend.update(grades);
  }





  }
);
