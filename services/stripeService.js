const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

async function createSession(services) {

  const lineItems = services.map(service => ({

    price_data:{
      currency:'rub',
      product_data:{
        name:service.name,
      },
      unit_amount:service.price * 100,
    },

    quantity:1,

  }))

  const session = await stripe.checkout.sessions.create({

    payment_method_types:['card'],
    mode:'payment',
    line_items:lineItems,

    success_url:'http://localhost:3000/success.html',
    cancel_url:'http://localhost:3000/cancel.html',

  })

  return session

}

module.exports = { createSession, stripe }