
// ******************************************************************************

// Sscript desarrollado para extraer informacion de los modelos climaticos CMIP6
// este script solo extrae la informacion de precipitaciones en base
// al area de una cuenca , esta se encuentra en formato shapefile, la extraccion
// solo se esta realizando para el periodo historico.

// ******************************************************************************

// autor: Kevin Arnold Traverso Yucra
// mail: arnold.traverso@gmail.com
// fecha: 18/abr/23

// ******************************************************************************

// 1. Ingresar la zona de interes

// Ingresar el shapefile

var HidroCuenca = ee.FeatureCollection("projects/ee-arnoldtraverso/assets/UH_amazonas");

// Agregar a mapa, en base a color

var estilo = {
  fillColor: 'blue',      // Relleno transparente en formato RGBA
  color: 'FFFFFF',        // Borde blanco en formato hexadecimal
  width: 2                // Ancho del borde en pixeles
};

var UHData = HidroCuenca.size().getInfo()

Map.addLayer(HidroCuenca.style(estilo))

// 2. Agregar los atributos para el GCM CMIP6

// Parametros

var listModel = ['ACCESS-CM2', 'ACCESS-ESM1-5', 
                 'BCC-CSM2-MR', 'CESM2', 'CESM2-WACCM', 'CMCC-CM2-SR5',
                 'CMCC-ESM2', 'CNRM-CM6-1', 'CNRM-ESM2-1', 'CanESM5', 'EC-Earth3', 'EC-Earth3-Veg-LR',
                 'FGOALS-g3', 'GFDL-CM4', 'GFDL-ESM4', 'GISS-E2-1-G', 'HadGEM3-GC31-LL', 'HadGEM3-GC31-MM',
                 'IITM-ESM', 'INM-CM4-8', 'INM-CM5-0', 'IPSL-CM6A-LR', 'KACE-1-0-G', 'KIOST-ESM',
                 'MIROC-ES2L', 'MIROC6', 'MPI-ESM1-2-HR', 'MPI-ESM1-2-LR', 'MRI-ESM2-0', 'NESM3',
                 'NorESM2-LM', 'NorESM2-MM', 'TaiESM1', 'UKESM1-0-LL'
                 ];
                 
var listScenario = ['historical'];
var listVariable = ['pr'];

var listGCMmodel = [];

// Trasformando

listModel.forEach(function(model){
  listScenario.forEach(function(scenario){
    listVariable.forEach(function(variable){
    var a = [model, scenario, variable]  
    listGCMmodel.push(a)
    })
  })
});

print('ver lista de modelos seleccionados', listGCMmodel)

// Llevando los datos a mm/dia

var PcpDATA = function(image){
  return image.multiply(86400)
  .copyProperties(image, ["system:time_start"]
  )};

// Loop para los modelos

var listEXP = ee.List([]);

for (var listGCM = 0; listGCM < listGCMmodel.length; listGCM++){
    var param = {model: listGCMmodel[listGCM][0],      // Modelo GCM
                 scenario: listGCMmodel[listGCM][1],   // experimento ssp/historical
                 variable: listGCMmodel[listGCM][2]    // pr, tasmin, tasmax
      
    }
    
  print('Mostrar modelo y escenario:', param.model, param.scenario)
    
  // Fechas del modelo historico, Formato Año mes dia (YYYY-MM-DD)
  
  var DateIni = '1990-01-01';
  var DateFin = '1990-12-31';
  
  // 3. Ejecucion para extrccion de datos
  
  for (var i = 1; i <= UHData; i++){
    
    var UH = HidroCuenca.filterMetadata('ID_UH', 'equals', i);
    
    var DatasetGCM = ee.ImageCollection("NASA/GDDP-CMIP6")
                     .filter(ee.Filter.date(DateIni, DateFin))
                     .filterMetadata('model', 'equals', param.model)
                     .filterMetadata('scenario', 'equals', param.scenario)
                     .filterBounds(UH);
    
    var SelectGCM = DatasetGCM.select(param.variable).map(PcpDATA);
    
    function extrac(image){
      var ValuesPCP = image.select(param.variable)
                      .reduceRegion({
                        reducer: ee.Reducer.mean(),
                        geometry: UH,
                        scale: 25000,
                        maxPixels: 1e12
                      }).get(param.variable)
                      
    var PCP = ee.Feature(null);
    
    return ee.Feature(PCP.set('valor',ee.Number(ValuesPCP))
                         .set('cuenca', 'UH_' + i)
                         .set('fecha', ee.String(image.date().format('YYYY-MM-DD'))))
                      
    }
    
    var PCPGCM = SelectGCM.map(extrac);
    listEXP = listEXP.add(PCPGCM);
    
  }
  
}

var DataEXP = ee.FeatureCollection(listEXP).flatten();


// ******************************************************************************
// Representando los valores extraidos
// ******************************************************************************

// Estilo de colores
var rgbVis = {
  bands: ['pr'],
  max: 20,
  min: 0,
  'palette': ['604791', '1d6b99', '39a8a7', '0f8755', '76b349', 'f0af07',
            'e37d05', 'cf513e', '96356f', '724173', '9c4f97', '696969']
};

// Seleccionado una fecha para plot

var featureCol = ee.ImageCollection(SelectGCM.filterDate('2012-02-01', '2012-02-02'));

// Agregando al mapa

Map.addLayer(featureCol, rgbVis);

// Estilo para shapefile de cuencas

var estilo2 = {
  fillColor: '00000000',  // Relleno transparente en formato RGBA
  color: 'FFFFFF',        // Borde blanco en formato hexadecimal
  width: 2                // Ancho del borde en pixeles
};

// Agregando al mapa

Map.addLayer(HidroCuenca.style(estilo2));

// ******************************************************************************
// Crear el gráfico de la serie de tiempo
// ******************************************************************************

var chartData = DataEXP.select(['fecha', 'valor']).limit(1825);

print(chartData)

// Ordenando la data

var timeSeriesChart = ui.Chart.feature.byFeature(chartData, 'fecha')
  .setChartType('LineChart')
  .setOptions({
    title: 'Serie de tiempo de valores filtrados',
    legend: { position: 'none' },
    hAxis: { title: 'Fecha' },
    vAxis: { title: 'Valor PP' },
    colors: ['0f8755', '0f8758']
  });

print(timeSeriesChart)

// ******************************************************************************
// Exportar a google Drive
// ******************************************************************************

Export.table.toDrive({
  collection: DataEXP,
  description: 'GCM_CMIP6_'+ param.variable + '_' + param.scenario,
  folder: 'GCM_CMIP6' + '_' + param.variable, 
  fileFormat: 'CSV'
})
