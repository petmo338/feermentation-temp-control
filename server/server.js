const i2c = require('i2c-bus')
const path = require('path')
const express = require('express')

var gpio = require('gpio')
var log4js = require('log4js')
var os = require('os')
var logger = log4js.getLogger()

logger.level = 'warning'
logger.debug("Some debug messages") 
const MCP9808_ADDR = 0x18
const TEMP_REG = 0x05
let P = 1.00001
var heatStatus = 1
let setPoint = 23.123
let currentTemp = 0

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

var gpio115 = gpio.export(18, {
  direction: gpio.DIRECTION.OUT,
  interval: 200,

  ready: function() {
    logger.info('GPIO pin enabled 18')
    disable()
  }
})

var gpio49 = gpio.export(17, {
  direction: gpio.DIRECTION.OUT,
  interval: 200,

  ready: function() {
    logger.info('GPIO pin enabled 17')
    disable()
  }
})

function enableCooling() {
  logger.info('enable cooling')
  gpio115.set()
  gpio49.reset()
  heatStatus = 0
}

function enableHeating() {
  logger.info('enable heating')
  gpio115.reset()
  gpio49.set()
  heatStatus = 2
}

function disable() {
  logger.info('stop action')
  gpio115.set()
  gpio49.set()
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
    logger.info(rawData)
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

const server = app.listen( 9000, () => console.log( 'Express server started!' ) )
