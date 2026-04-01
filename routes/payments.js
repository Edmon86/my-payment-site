const express = require('express')
const router = express.Router()

const { createSession } = require('../services/stripeService')

router.post('/create-checkout-session', async(req, res)=>{

  const { services } = req.body

  try {

    const session = await createSession(services)

    res.json({ id:session.id })

  } catch (err) {

    res.status(500).json({ error:err.message })

  }

})

module.exports = router