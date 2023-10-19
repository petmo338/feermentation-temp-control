const fs = require('fs')
const child_process = require('child_process')

class gpio {
  _update(action, data) {
    let cmd = undefined
    if (action === 'export') {
      cmd = 'echo ' + this.pinNr + ' > /sys/class/gpio/export'
    } else if (action == 'unexport') {
      cmd = 'echo ' + this.pinNr + ' > /sys/class/gpio/unexport'
    } else if (action == 'direction') {
      cmd = 'echo ' + data + ' > /sys/class/gpio/gpio' + this.pinNr + '/direction'
    } else if (action == 'value') {
      cmd = 'echo ' + data + ' > /sys/class/gpio/gpio' + this.pinNr + '/value'
    }
    if (cmd) {
      child_process.execSync(cmd)
    }
  }
  export(pinNr) {
    this.pinNr = pinNr
    if (fs.existsSync('/sys/class/gpio/gpio' + this.pinNr + '/value')) {
      this.unexport()
    }
    this._update('export', undefined)
    this._update('direction', 'out')
    this._update('value', '0')
  }
  unexport() {
    this._update('direction', 'in')
    this._update('unexport', undefined)
  }
  set() {
    this._update('value', '1')
  }
  unset() {
    this._update('value', '0')
  }
  get() {
    return parseInt(fs.readFileSync('/sys/class/gpio/gpio' + this.pinNr + '/value'))
  }
}

module.exports.gpio = gpio
