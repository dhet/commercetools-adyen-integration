const { expect } = require('chai')
const _ = require('lodash')

const ctpClientBuilder = require('../../src/ctp/ctp-client')
const iTSetUp = require('./integration-test-set-up')
const paymentTemplate = require('../fixtures/payment-kcp.json')

describe('kcp make payment', () => {
  let ctpClient

  beforeEach(async () => {
    ctpClient = ctpClientBuilder.get()
    await iTSetUp.initServerAndExtension(ctpClient)
  })

  afterEach(async () => {
    await iTSetUp.cleanupResources(ctpClient)
  })

  it('should create kcp redirect', async () => {
    const paymentDraft = _.cloneDeep(paymentTemplate)
    const response = await ctpClient.create(ctpClient.builder.payments, paymentDraft)

    expect(response.statusCode).to.equal(201)
    const adyenRequest = JSON.parse(response.body.interfaceInteractions[0].fields.request)
    expect(adyenRequest.headers['x-api-key']).to.be.equal(process.env.ADYEN_API_KEY)
    expect(response.body.custom.fields.redirectMethod).to.equal('GET')
    expect(response.body.custom.fields.redirectUrl).to.exist
  })
})
