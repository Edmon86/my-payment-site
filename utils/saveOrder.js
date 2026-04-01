const fs = require('fs')
const path = require('path')

function saveOrder(order) {

  const file = path.join(__dirname, '../data/orders.json')

  let orders = []

  if (fs.existsSync(file)) {
    orders = JSON.parse(fs.readFileSync(file))
  }

  orders.push(order)

  fs.writeFileSync(file, JSON.stringify(orders, null, 2))

}

module.exports = saveOrder