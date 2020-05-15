<template>
  <section>
    <p>
        <b-field label="Set Temperature">
          <b-numberinput v-model="setpoint" step="0.2" min="4.0" max="40.0" rounded></b-numberinput>
        </b-field>
        <!-- <b-button @click="setTemp">Set Temp</b-button> -->
    <p>
    <p>Current temp = {{ currTemp }}</p>
  </section>
</template>

<script>
export default {
  // methods: {
  //   setTemp() {
  //     this.$store.commit('setTemp', this.setpoint.value)
  //   }
  // },
  name: 'Temperature',
  // mounted: {
  // },
  computed: {
    currTemp: function () {
      return this.$store.state.currentTemp
    },
    setpoint: {
      get () {
        return this.$store.state.setpoint
      },
      set (value) {
        this.$store.commit('setTemp', value)
      }
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
