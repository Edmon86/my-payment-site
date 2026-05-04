require('dotenv').config()
const express = require('express')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')
const dns = require('dns')
const net = require('net')

const app = express()
const PORT = process.env.PORT || 3000

/* ========================
   БАЗА УСЛУГ
======================== */
const SERVICES = {
  site: { name: 'Разработка сайта', price: 1500 },
  ads: { name: 'Настройка рекламы', price: 800 },
  logo: { name: 'Дизайн логотипа', price: 500 },
}

async function resolveDns(hostname, type) {
  try {
    const records = type === 'A'
      ? await dns.promises.resolve4(hostname)
      : await dns.promises.resolve6(hostname)

    return { ok: true, records }
  } catch (err) {
    return {
      ok: false,
      code: err.code,
      message: err.message,
    }
  }
}

function checkTcpConnection({ name, host, port, family }) {
  return new Promise(resolve => {
    const startedAt = Date.now()
    const socket = net.createConnection({ host, port, family })

    function finish(result) {
      socket.destroy()
      resolve({
        name,
        host,
        port,
        family,
        durationMs: Date.now() - startedAt,
        ...result,
      })
    }

    socket.setTimeout(8000)

    socket.once('connect', () => {
      finish({
        ok: true,
        remoteAddress: socket.remoteAddress,
        remoteFamily: socket.remoteFamily,
      })
    })

    socket.once('timeout', () => {
      finish({
        ok: false,
        code: 'ETIMEDOUT',
        message: 'Connection timeout',
      })
    })

    socket.once('error', err => {
      finish({
        ok: false,
        code: err.code,
        message: err.message,
        address: err.address,
      })
    })
  })
}

/* ========================
   BASIC AUTH (ADMIN)
======================== */
function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"')
    return res.status(401).send('Authorization required')
  }

  const base64 = authHeader.split(' ')[1]
  const decoded = Buffer.from(base64, 'base64').toString('utf-8')
  const [login, password] = decoded.split(':')

  if (
    login === process.env.ADMIN_LOGIN &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return next()
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"')
  return res.status(401).send('Wrong credentials')
}

/* ========================
   ADMIN
======================== */
app.get('/admin', basicAuth, (req, res) => {
  const ordersFile = path.join(__dirname, 'data', 'orders.json')

  if (!fs.existsSync(ordersFile)) {
    return res.json([])
  }

  const orders = JSON.parse(fs.readFileSync(ordersFile))
  res.json(orders)
})

app.get('/admin/smtp-check', basicAuth, async(req, res) => {
  const checks = [
    { name: 'Gmail SMTP 465 IPv4', host: 'smtp.gmail.com', port: 465, family: 4 },
    { name: 'Gmail SMTP 587 IPv4', host: 'smtp.gmail.com', port: 587, family: 4 },
    { name: 'Gmail SMTP 465 IPv6', host: 'smtp.gmail.com', port: 465, family: 6 },
    { name: 'Gmail SMTP 587 IPv6', host: 'smtp.gmail.com', port: 587, family: 6 },
    { name: 'Stripe API 443 IPv4', host: 'api.stripe.com', port: 443, family: 4 },
  ]

  const [gmailA, gmailAaaa, stripeA, tcp] = await Promise.all([
    resolveDns('smtp.gmail.com', 'A'),
    resolveDns('smtp.gmail.com', 'AAAA'),
    resolveDns('api.stripe.com', 'A'),
    Promise.all(checks.map(checkTcpConnection)),
  ])

  res.json({
    checkedAt: new Date().toISOString(),
    env: {
      MAIL_USER: Boolean(process.env.MAIL_USER),
      EMAIL_PASS: Boolean(process.env.EMAIL_PASS),
      MAIL_USER_LENGTH: process.env.MAIL_USER?.length || 0,
      EMAIL_PASS_LENGTH: process.env.EMAIL_PASS?.length || 0,
    },
    dns: {
      smtpGmailComA: gmailA,
      smtpGmailComAaaa: gmailAaaa,
      apiStripeComA: stripeA,
    },
    tcp,
  })
})

/* ========================
   WEBHOOK (ВАЖНО ДО express.json)
======================== */
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature']

  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    console.error('❌ Webhook ошибка:', err.message)
    return res.sendStatus(400)
  }

  if (event.type === 'checkout.session.completed') {
    console.log('🔥 WEBHOOK СРАБОТАЛ')

    const session = event.data.object
    const services = JSON.parse(session.metadata?.services || '[]')

    const order = {
      id: session.id,
      email: session.customer_details?.email || session.customer_email || null,
      amount: session.amount_total / 100,
      currency: session.currency,
      status: session.payment_status,
      services,
      created: new Date().toISOString(),
    }

    console.log('📦 Заказ:', order)

    // 📁 Сохранение
    const dataDir = path.join(__dirname, 'data')
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)

    const ordersFile = path.join(dataDir, 'orders.json')

    let orders = []
    if (fs.existsSync(ordersFile)) {
      orders = JSON.parse(fs.readFileSync(ordersFile))
    }

    orders.push(order)
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2))

    console.log('✅ Заказ сохранён')

    // 📧 EMAIL
    if (order.email) {
      console.log('🚀 Отправка email через Gmail...')

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })

      const message = {
        from: process.env.MAIL_USER,
        to: order.email,
        subject: 'Ваш заказ успешно оплачен ✅',
        html: `
          <h2>Спасибо за заказ!</h2>
          <p>Заказ № <b>${order.id}</b> оплачен</p>
          <ul>
            ${services.map(s => `<li>${s.name} — ${s.price} ₽</li>`).join('')}
          </ul>
          <p><b>Итого: ${order.amount} ₽</b></p>
        `,
      }

      transporter.sendMail(message)
        .then(() => console.log('✅ Email отправлен'))
        .catch(err => console.error('❌ Ошибка Gmail:', err))
    }
  }

  res.json({ received: true })
})

/* ========================
   ПОСЛЕ webhook!
======================== */
app.use(express.static('public'))
app.use(express.json())

/* ========================
   CHECKOUT
======================== */
app.post('/create-checkout-session', async(req, res) => {
  const { services, email } = req.body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Неверный email' })
  }

  try {
    const lineItems = services.map(id => ({
      price_data: {
        currency: 'rub',
        product_data: { name: SERVICES[id].name },
        unit_amount: SERVICES[id].price * 100,
      },
      quantity: 1,
    }))

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      customer_email: email,
      metadata: {
        services: JSON.stringify(services.map(id => SERVICES[id])),
      },
      success_url: 'https://my-payment-site-1.onrender.com/success.html',
      cancel_url: 'https://my-payment-site-1.onrender.com/cancel.html',
    })

    res.json({ id: session.id })
  } catch (err) {
    console.error('❌ Stripe ошибка:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/* ========================
   SERVER
======================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
