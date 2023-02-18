require('dotenv').config()
const i2c = require('i2c-bus')
const path = require('path')
const express = require('express')
const Influx = require('influx')
const axios = require('axios')
const gpio = require('./gpio')
var log4js = require('log4js')
var os = require('os')
var logger = log4js.getLogger()
const {InfluxDB, Point, HttpError} = require('@influxdata/influxdb-client')

logger.level = 'debug'
logger.debug("Some debug messages") 
const MCP9808_ADDR = 0x18
const TEMP_REG = 0x05
let P = 0.00001
var heatStatus = 1
let setPoint = 22.123
let currentTemp = 0
const measurementName = 'testOne'
const dbName = 'ferment'
const dbHost = '172.16.201.17'
const GPIO_1 = 17
const GPIO_2 = 18


const i2c2 = i2c.openSync(1)

const toCelsius = (rawData) => {
  rawData = (rawData >> 8) + ((rawData & 0xff) << 8)
  let celsius = (rawData & 0x0fff) / 16
  logger.info(celsius) 
  if (rawData & 0x1000) {
    celsius -= 256
  }
  logger.info(celsius) 
  return celsius
}

const gpio17 = new gpio.gpio()
const gpio18 = new gpio.gpio()
gpio17.export(GPIO_1)
gpio18.export(GPIO_2)

// process.on('exit', function() {
//  gpio.destroy()
// })

function displayGpioError(error) {
  logger.error('GPIO activity')
  if (error) {
    logger.error('GPIO:' + error)
  }
}

function enableCooling() {
  logger.info('enable cooling')
  gpio17.unset()
  gpio18.set()
  heatStatus = 0
}

function enableHeating() {
  logger.info('enable heating')
  gpio17.set()
  gpio18.unset()
  heatStatus = 2
}

function disable() {
  logger.info('stop action')
  gpio17.unset()
  gpio18.unset()
  heatStatus = 1
}

function getSetpoint() {
  return setPoint
}

function getHeatStatusName() {
  if (heatStatus === 0) return 'Cooling'
  if (heatStatus === 1) return 'Off'
  if (heatStatus === 2) return 'Heating'  
  return 'Unknown heatStatus value' + heatStatus
}


async function measure() {
  if (i2c2) {
    var rawData = i2c2.readWordSync(MCP9808_ADDR, TEMP_REG) // , (err, rawData) => {
    logger.info('Raw data: ' + rawData)
    return toCelsius(rawData)
  }
}

async function control() {
  // logger.info('starting control')
  currentTemp = await measure()
  // logger.info(tempCelsius)
    
  logger.info(getSetpoint())
  var err = parseFloat(currentTemp) - parseFloat(getSetpoint())
  logger.info('Error*P = ' + err*P)
  if (err*P > 1) {
    enableCooling()
    logger.info('err*P > 1')
  } else if (err*P < -1) {
    enableHeating()
    logger.info('err*P < -1')
  } else if (Math.abs(err*P) < 0.2) {
    disable()
  }
}

setInterval(control, 200)

async function report() {
  // var tempCelsius = await measure()
  logger.info(currentTemp + '------------------------------------')

  const point1 = new Point('temperature')
    .floatField('tempBarrel', currentTemp)
    .floatField('setPoint', setPoint)
    .intField('heatStatus', heatStatus)
  logger.info(writeApi.writePoint(point1))

//  influx.writePoints([
//    {
//      measurement: measurementName,
//      tags: { device: 'bbb1' },
//        fields: { tempBarrel: currentTemp, setPoint: setPoint, heatStatus: heatStatus },
//    }
//  ]).catch(err => {
//    logger.error('Error saving data to InfluxDB!' + err.stack)
//  })

}

const writeApi = new InfluxDB({url: process.env.URL, token: process.env.TOKEN}).getWriteApi('primary', process.env.BUCKET, 'ms')
// setup default tags for all writes through this API
writeApi.useDefaultTags({location: os.hostname()})


const influx = new Influx.InfluxDB({
  host: dbHost,
  database: dbName,
  schema: [
      {
	  measurement: measurementName,
	  fields: {
              bpm: Influx.FieldType.FLOAT,
              plaatotemp: Influx.FieldType.FLOAT,
              sg: Influx.FieldType.FLOAT,
              bubbles: Influx.FieldType.FLOAT,
              abv: Influx.FieldType.FLOAT,
              og: Influx.FieldType.FLOAT,
              co2volume: Influx.FieldType.FLOAT,
	      tempBarrel: Influx.FieldType.FLOAT,
	      setPoint: Influx.FieldType.FLOAT,
	      heatStatus: Influx.FieldType.INTEGER
	  },
	  tags: [
	      'device'
	  ]
      }
  ]
})

// influx.getDatabaseNames()
//   .then(names => {
//     if (!names.includes(dbName)) {
//       return influx.createDatabase(dbName)
//     }
//   })
//   .catch(err => {
//     console.error('Error creating Influx database!')
//   })

setInterval(report, 15000)

setInterval(function () {
    console.log('Log to brewfather')
    axios.post('http://log.brewfather.net/stream?id=n7TZFmH3iwDOuq',
	       { name: "fermentationTempController",
		 aux_temp: setPoint,
		 temp: currentTemp,
		 temp_unit: "C",
		 heatStatus: 2
	       })
	.then((response) => { console.log(response) }
	     )},
	    1000*60*20)

const app = express()

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

const localHostName = os.hostname()

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*") // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "*")
  next()
})

app.get('/', function (req, res) {
  console.log(req.body)
  response = {
    'hostname': localHostName,
    'timeUTC': new Date(new Date().toUTCString()),
    'setPoint1': setPoint,
    'currentTemp1': currentTemp,
    'heatStatus': heatStatus,
    'heatStatusName': getHeatStatusName(),
    'P': P,
    'extra': 'blah'
  }
  res.send(response)
})

app.get('/currentTemp', function (req, res) {
  console.log(req.body)
  response = {
    'currentTemp1': currentTemp
  }
  res.send(response)
})

app.get('/setPoint', function (req, res) {
  console.log(req.body)
  response = {
    'setPoint1': setPoint
  }
  res.send(response)
})

app.get('/heatStatus', function (req, res) {
  console.log(req.body)
  response = {
    'heatStatus': heatStatus,
    'heatStatusName': getHeatStatusName()
  }
  res.send(response)
})

app.get('/P', function (req, res) {
  console.log(req.body)
  response = {
    'P': P
  }
  res.send(response)
})

app.post('/setPoint', function (req, res) {
  console.log(req.body)
  tempSP = parseFloat(req.body.setPoint1)
  console.log(tempSP)
  if (tempSP != NaN) {
    setPoint = tempSP
    response = {
      'setPoint1': setPoint
    }
    res.send(response)
  } else {
    res.status(400).send('Bad Request')  
  }
})

app.post('/P', function (req, res) {
  console.log(req.body)
  tempP = parseFloat(req.body.P)
  console.log(tempP)
  if (tempP != NaN) {
    P = tempP
    response = {
      'P': P
    }
    res.send(response)
  } else {
    res.status(400).send('Bad Request')  
  }
})

const server = app.listen( 80, () => console.log( 'Express server started!' ) )
