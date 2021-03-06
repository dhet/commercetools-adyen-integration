// fake window and navigator because of adyen-cse-js module
global.window = {}
global.navigator = {}

const { expect } = require('chai')

const ctpClientBuilder = require('../../src/ctp/ctp-client')
const paymentTemplate = require('../fixtures/payment-credit-card.json')
const payment3dTemplate = require('../fixtures/payment-credit-card-3d.json')
const iTSetUp = require('./integration-test-set-up')
const testUtils = require('../test-utils')
const c = require('../../src/config/constants')

describe('credit card payment', () => {
  let ctpClient

  beforeEach(async () => {
    ctpClient = ctpClientBuilder.get()
    await iTSetUp.initServerAndExtension(ctpClient)
  })

  afterEach(async () => {
    await iTSetUp.cleanupResources(ctpClient)
  })

  it('should create success payment', async () => {
    const paymentDraft = testUtils.createCreditCardPaymentDraft({
      cardNumber: '4111111145551142',
      cvc: '737',
      expiryMonth: '10',
      expiryYear: '2020'
    })

    const response = await ctpClient.create(ctpClient.builder.payments, JSON.parse(paymentDraft))
    expect(response.statusCode).to.equal(201)
    const adyenRequest = JSON.parse(response.body.interfaceInteractions[0].fields.request)
    expect(adyenRequest.headers['x-api-key']).to.be.equal(process.env.ADYEN_API_KEY)

    const adyenRequestBody = JSON.parse(adyenRequest.body)
    expect(adyenRequestBody.merchantAccount).to.be.equal(process.env.ADYEN_MERCHANT_ACCOUNT)
    expect(adyenRequestBody.reference).to.be.equal(paymentTemplate.custom.fields.merchantReference)
    expect(adyenRequestBody.returnUrl).to.be.equal(paymentTemplate.custom.fields.returnUrl)
    expect(adyenRequestBody.amount.currency).to.be.equal(paymentTemplate.transactions[0].amount.currencyCode)
    expect(adyenRequestBody.amount.value).to.be.equal(paymentTemplate.transactions[0].amount.centAmount)
    expect(adyenRequestBody.paymentMethod.type).to.be.equal('scheme')
    expect(adyenRequestBody.paymentMethod.encryptedExpiryYear).to.have.string('adyenjs_')
    expect(adyenRequestBody.paymentMethod.encryptedCardNumber).to.have.string('adyenjs_')
    expect(adyenRequestBody.paymentMethod.encryptedExpiryMonth).to.have.string('adyenjs_')
    expect(adyenRequestBody.paymentMethod.encryptedSecurityCode).to.have.string('adyenjs_')

    const adyenResponse = JSON.parse(response.body.interfaceInteractions[0].fields.response)
    expect(adyenResponse.resultCode).to.be.equal('Authorised')

    const { transactions } = response.body
    expect(transactions).to.have.lengthOf(1)
    expect(transactions[0].type).to.equal('Charge')
    expect(transactions[0].state).to.equal('Success')
    expect(transactions[0].interactionId).to.match(/^[0-9a-zA-Z]*$/)
  })

  it('should create 3ds redirect', async () => {
    const ngrokUrl = process.env.API_EXTENSION_BASE_URL

    const paymentDraft = testUtils.createCreditCard3DSPaymentDraft({
      cardNumber: '5212345678901234',
      cvc: '737',
      expiryMonth: '10',
      expiryYear: '2020',
      returnUrl: `${ngrokUrl}/test-return-url`
    })

    const response = await ctpClient.create(ctpClient.builder.payments, JSON.parse(paymentDraft))
    const adyenRequest = JSON.parse(response.body.interfaceInteractions[0].fields.request)
    expect(adyenRequest.headers['x-api-key']).to.be.equal(process.env.ADYEN_API_KEY)

    const adyenRequestBody = JSON.parse(adyenRequest.body)
    expect(adyenRequestBody.merchantAccount).to.be.equal(process.env.ADYEN_MERCHANT_ACCOUNT)
    expect(adyenRequestBody.reference).to.be.equal(paymentTemplate.custom.fields.merchantReference)
    expect(adyenRequestBody.returnUrl).to.be.equal(`${process.env.API_EXTENSION_BASE_URL}/test-return-url`)
    expect(adyenRequestBody.amount.currency).to.be.equal(paymentTemplate.transactions[0].amount.currencyCode)
    expect(adyenRequestBody.amount.value).to.be.equal(paymentTemplate.transactions[0].amount.centAmount)
    expect(adyenRequestBody.paymentMethod.type).to.be.equal('scheme')
    expect(adyenRequestBody.paymentMethod.encryptedExpiryYear).to.have.string('adyenjs_')
    expect(adyenRequestBody.paymentMethod.encryptedCardNumber).to.have.string('adyenjs_')
    expect(adyenRequestBody.paymentMethod.encryptedExpiryMonth).to.have.string('adyenjs_')
    expect(adyenRequestBody.paymentMethod.encryptedSecurityCode).to.have.string('adyenjs_')
    expect(adyenRequestBody.additionalData.executeThreeD).to.be.equal('true')
    expect(adyenRequestBody.browserInfo).to.be.eql(JSON.parse(payment3dTemplate.custom.fields.browserInfo))

    expect(response.statusCode).to.equal(201)
    const adyenResponse = JSON.parse(response.body.interfaceInteractions[0].fields.response)
    expect(adyenResponse.redirect.data.PaReq).to.exist
    expect(adyenResponse.redirect.data.TermUrl).to.exist
    expect(adyenResponse.redirect.data.MD).to.exist
    expect(adyenResponse.redirect.method).to.exist
    expect(adyenResponse.redirect.url).to.exist
  })

  it('on wrong credit card number, should log error to interface interaction', async () => {
    const paymentDraft = testUtils.createCreditCardPaymentDraft({
      cardNumber: '0123456789123456',
      cvc: '737',
      expiryMonth: '10',
      expiryYear: '2020'
    })

    const response = await ctpClient.create(ctpClient.builder.payments, JSON.parse(paymentDraft))
    expect(response.statusCode).to.equal(201)
    const ctpPayment = response.body
    expect(ctpPayment.interfaceInteractions[0].fields.status).to.equal(c.FAILURE)

    const adyenRequest = JSON.parse(ctpPayment.interfaceInteractions[0].fields.request)
    expect(adyenRequest.headers['x-api-key']).to.be.equal(process.env.ADYEN_API_KEY)

    const adyenRequestBody = JSON.parse(adyenRequest.body)
    expect(adyenRequestBody.merchantAccount).to.be.equal(process.env.ADYEN_MERCHANT_ACCOUNT)
    expect(adyenRequestBody.returnUrl).to.be.equal(paymentTemplate.custom.fields.returnUrl)
    expect(adyenRequestBody.amount.currency).to.be.equal(paymentTemplate.transactions[0].amount.currencyCode)
    expect(adyenRequestBody.amount.value).to.be.equal(paymentTemplate.transactions[0].amount.centAmount)
    expect(adyenRequestBody.paymentMethod.type).to.be.equal('scheme')
    expect(adyenRequestBody.paymentMethod.encryptedExpiryYear).to.have.string('adyenjs_')
    expect(adyenRequestBody.paymentMethod.encryptedCardNumber).to.have.string(false)
    expect(adyenRequestBody.paymentMethod.encryptedExpiryMonth).to.have.string('adyenjs_')
    expect(adyenRequestBody.paymentMethod.encryptedSecurityCode).to.have.string('adyenjs_')

    const adyenResponse = JSON.parse(ctpPayment.interfaceInteractions[0].fields.response)
    expect(adyenResponse.errorCode).to.match(/^[0-9a-zA-Z]*$/)
    expect(adyenResponse.errorType).to.equal('validation')
    const { transactions } = ctpPayment
    expect(transactions).to.have.lengthOf(1)
    const transaction = transactions[0]
    expect(transaction.interactionId).to.be.undefined
    expect(transaction.type).to.equal('Charge')
    expect(transaction.state).to.equal('Initial')

    const response2 = await ctpClient.update(ctpClient.builder.payments,
      ctpPayment.id, ctpPayment.version, [
        {
          action: 'setCustomField',
          name: 'encryptedSecurityCode',
          value: ctpPayment.custom.fields.encryptedSecurityCode
        }
      ])
    expect(response2.statusCode).to.equal(200)
    expect(response2.body.interfaceInteractions).to.have.lengthOf(1)
  })
})
