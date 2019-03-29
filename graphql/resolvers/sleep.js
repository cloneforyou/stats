const fetch = require('../lib/fetchWithTimeout')
const format = require('date-fns/format')
const { thirtyDaysAgo } = require('../lib/date')

const getSleep = () => {
  const uri = `https://api.fitbit.com/1.2/user/-/sleep/date/${format(
    thirtyDaysAgo(),
    'YYYY-MM-DD'
  )}/${format(Date.now(), 'YYYY-MM-DD')}.json`

  const options = {
    headers: {
      Authorization: `Bearer ${process.env.FITBIT_KEY}`,
    },
  }

  const countSleep = data => {
    if (!data.sleep) {
      throw new Error(`FitBit responded without a sleep object`)
    }

    let duration = null

    if (data.sleep) {
      duration = 0

      data.sleep.forEach(night => {
        duration += night.duration / 1000 / 60 / 60
      })
    }

    return duration
  }

  return fetch(uri, options, countSleep)
}

module.exports = getSleep
