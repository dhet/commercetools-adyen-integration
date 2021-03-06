const { expect } = require('chai')
const _ = require('lodash')

const ctpClientBuilder = require('../../src/ctp/ctp-client')
const paymentTemplate = require('../fixtures/payment-no-method.json')
const iTSetUp = require('./integration-test-set-up')

describe('fetch payment', () => {
  let ctpClient

  before(async () => {
    ctpClient = ctpClientBuilder.get()
    await iTSetUp.initServerAndExtension(ctpClient)
  })

  after(async () => {
    await iTSetUp.cleanupResources(ctpClient)
  })

  it('should fetch payment methods when no method set', async () => {
    const paymentTplClone = _.cloneDeep(paymentTemplate)
    const response = await ctpClient.create(ctpClient.builder.payments, paymentTplClone)
    expect(response.statusCode).to.equal(201)

    const interfaceInteractionFields = response.body.interfaceInteractions[0].fields
    expect(interfaceInteractionFields.type).to.be.equal('getAvailablePaymentMethods')
    const adyenRequest = JSON.parse(interfaceInteractionFields.request)
    expect(adyenRequest.headers['x-api-key']).to.be.equal(process.env.ADYEN_API_KEY)

    const adyenRequestBody = JSON.parse(adyenRequest.body)
    expect(adyenRequestBody.merchantAccount).to.be.equal(process.env.ADYEN_MERCHANT_ACCOUNT)
    expect(adyenRequestBody.countryCode).to.be.equal(paymentTemplate.custom.fields.countryCode)
    expect(adyenRequestBody.amount.currency).to.be.equal(paymentTemplate.amountPlanned.currencyCode)
    expect(adyenRequestBody.amount.value).to.be.equal(paymentTemplate.amountPlanned.centAmount)

    const adyenResponse = JSON.parse(interfaceInteractionFields.response)
    expect(adyenResponse.groups).to.be.an.instanceof(Array)
    expect(adyenResponse.paymentMethods).to.be.an.instanceof(Array)
  })
})
