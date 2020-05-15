/* eslint-disable no-console */
import Vue from 'vue'
import Vuex from 'vuex'
import http from 'http'
import { string } from 'postcss-selector-parser'

Vue.use(Vuex)

const store = new Vuex.Store({
  state: {
    currentTemp: 123,
    setpoint: 30,
    newTemp: 0
  },
  mutations: {
    setTemp (state, temp) {
      state.setpoint = temp
    },
    currTemp (state, temp) {
      state.currentTemp = temp
    }
  },
  actions: {
    getTemp ({ commit }) {
      commitAPIFloat(commit, '/currentTemp', 'currentTemp1', 'currTemp')
    },
    getSetpoint ({ commit}) {
      commitAPIFloat(commit, '/setPoint', 'setPoint1', 'setTemp')
    }
  },
  modules: {
  }
})

async function commitAPIFloat(commit, endpoint, valueName, storeName) {
  // console.log(valueName)
  const options = {
    hostname: '172.16.200.200',
    port: 9000,
    path: endpoint,
    method: 'GET',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*'
    }
  }
  
  const req = http.request(options, res => {
    // console.log(`statusCode: ${res.statusCode}`)
    // console.log(res)
    res.on('data', d => {
      console.log(JSON.parse(d))
      let value = parseFloat(JSON.parse(d)[valueName])
      if (!isNaN(value)) {
        commit(storeName, value)
      } else {
        console.error('Unparseable float (' + string(valueName) + '): ' + d[valueName])
      }
    })
  })
  
  req.on('error', error => {
    console.error(error)
  })
  
  req.end()
  return undefined
}

export default store

// setInterval(function () {
//   store.commit('currTemp', store.state.setpoint -0.5 + Math.random())
// }, 250)
setInterval(function () {
  store.dispatch('getTemp')
}, 2000)
