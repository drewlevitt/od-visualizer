# od-visualizer
Interactively visualize OD flows with Leaflet and D3

# Resources I drew on
- http://218consultants.com/suitability/webmap.html
- https://leafletjs.com/examples/choropleth/
- https://observablehq.com/@d3/quantile-quantize-and-threshold-scales
- https://www.d3-graph-gallery.com/graph/line_filter.html
- http://bl.ocks.org/yellowcap/03cd4a6c72f661377f7e

# Sample data
- Polygons
    - [Cartographic Boundary Files](https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html) from the Census Bureau - download all US counties, filter down to California counties
    - export as GeoJSON (in ArcGIS Pro, but could have used any other GIS software)
    - adjust GeoJSON coordinate precision (down from a preposterous 14 decimal points to a more reasonable 4 decimal points, about 10 meters accuracy) using https://github.com/jczaplew/geojson-precision
- Flows
    - [Commuting Flows](https://www.census.gov/topics/employment/commuting/guidance/flows.html) from the Census Bureau - download all US county-to-county flows, filter down to flows among California counties
    - lightly process in Excel to produce simple schema: `year` (downloaded 2015 and 2010, just to have a field to filter on via drop-down), `o_id` (residence county FIPS code), `o_name` (residence county name, sans " County"), `d_id`/`d_name` (employment county FIPS code/name), `vol` (commute flow)
