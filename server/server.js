const i2c = require('i2c-bus')
const Influx = require('influx')
const process = require('process')
const https = require('https')
const path = require('path')
const express = require('express')
const socketIO = require('socket.io' )


var gpio = require('gpio')
var log4js = require('log4js')
var os = require('os')
var logger = log4js.getLogger()

logger.level = 'debug'
logger.debug("Some debug messages") 
const MCP9808_ADDR = 0x18
const TEMP_REG = 0x05
const P = 1.00001
var heatStatus = 1
let setPoint = 23.123
const measurementName = 'testOne'
const dbName = 'ferment'
const dbHost = '172.16.201.17'

const start = Date.now()

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

process.on('beforeExit', (code) => {
  console.log('Process beforeExit event with code: ', code)
  if (i2c2) {
    i2c2.close((err) => {
      if (err) throw err
    })
  }
})

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

function getSetpoint(time) {
  return setPoint
}


async function measure() {
  if (i2c2) {
    var rawData = i2c2.readWordSync(MCP9808_ADDR, TEMP_REG) // , (err, rawData) => {
//       if (err) {
//       throw err
//      } else {
//        logger.info(rawData)
//        return toCelsius(rawData)
//      }
      //    })
    logger.info(rawData)
    return toCelsius(rawData)
  }
}

async function control() {
  // logger.info('starting control')
  var tempCelsius = await measure()
  logger.info(tempCelsius)
    
  var setPoint = getSetpoint()
  logger.info(setPoint)
  var err = parseFloat(tempCelsius) - parseFloat(setPoint)
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

async function report() {
  var tempCelsius = await measure()
  logger.info(tempCelsius)
  influx.writePoints([
    {
      measurement: measurementName,
      tags: { device: 'bbb1' },
        fields: { tempBarrel: tempCelsius, setPoint: getSetpoint(), heatStatus: heatStatus },
    }
  ]).catch(err => {
    logger.error('Error saving data to InfluxDB!' + err.stack)
  })

  const options = new URL('https://api.thingspeak.com/update?api_key=PFJ7GCHC5UG7FX8W&field1=' + tempCelsius + '&field2=' + getSetpoint() + '&field3=' + heatStatus)
  const req = https.request(options, (res) => {
    logger.info(res.statusMessage)
  })
  req.on('error', (e) => {
    logger.error(e)
  })
  req.end()
    var options2 = {
	"method": "POST",
	"hostname": "eu-central-1-1.aws.cloud2.influxdata.com",
	"path": "/api/v2/write?org=petmo338@gmail.com&bucket=ferment&precision=s",
	"headers": {
	    "Authorization": "Token rg6f9mBv4G0r3ze2iIwArhIv_y1bD7ZUPne09EwtLAVjiu92q4ztad4IBTGrjoaoDx9EeaEpaJXJS02Gn9UZBQ==",
	    'Content-Type': 'text/plain'
	}
    }

    var req2 = https.request(options2, function (res) {
	console.log(`STATUS: ${res.statusCode}`)
	console.log(`HEADERS: ${JSON.stringify(res.headers)}`)
	var chunks = []

	res.on("end", function () {
	    logger.info('res.on.end')
	    logger.info(res.status)
	})
    })

    req2.write("temp value="+tempCelsius)
    req2.on('error', (e) => {
	console.log(e)
    })
   
    req2.end()

    io.emit('status', { tempBarrel: tempCelsius, setPoint: getSetpoint(), heatStatus: heatStatus })
}

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

influx.getDatabaseNames()
  .then(names => {
    if (!names.includes(dbName)) {
      return influx.createDatabase(dbName)
    }
  })
  .catch(err => {
    console.error('Error creating Influx database!')
  })

// setInterval(measure, 10000)
setInterval(control, 2000)
setInterval(report, 15000)


// create an express app
const app = express()

// send `index.html` from the current directory
// when `http://<ip>:9000/` route is accessed using `GET` method
app.get( '/', ( request, response ) => {
  response.sendFile( path.resolve( __dirname, 'assets/index.html' ), {
    headers: {
      'Content-Type': 'text/html',
    }
  } )
} )

// send asset files
app.use( '/assets/', express.static( path.resolve( __dirname, 'assets' ) ) )
app.use( '/assets/', express.static( path.resolve( __dirname, 'node_modules/socket.io-client/dist' ) ) )

// server listens on `9000` port
const server = app.listen( 9000, () => console.log( 'Express server started!' ) )

// create a WebSocket server
const io = socketIO( server )

// listen for connection
io.on( 'connection', ( client ) => {
  console.log( 'SOCKET: ', 'A client connected', client.id )

  // client.on( 'get-setPoint', ( data ) => {
  //   console.log( 'Received get-setPoint event.' )
  //   toggle( data.r, data.g, data.b ) // toggle LEDs
  // } )
  client.on( 'set-setPoint', ( data ) => {
    console.log( 'Received set-setPoint event.' )
    let setPointChanged = false
    // if (setPoint !== data.setPoint) {
    //   setPointChanged = true
    // } else {
    //   setPointChanged = false
    // }
    setPoint = data.setPoint // toggle LEDs
    // if (setPointChanged) {
    //   io.emit('setPoint-changed', {setPoint: setPoint})
    // }

  } )

} )
