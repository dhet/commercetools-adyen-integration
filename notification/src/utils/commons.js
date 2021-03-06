function collectRequestData (request) {
  return new Promise((resolve) => {
    const data = []

    request.on('data', (chunk) => {
      data.push(chunk)
    })

    request.on('end', () => {
      resolve(data)
    })
  })
}

function sendResponse (response, statusCode = 200, headers, data) {
  response.writeHead(statusCode, headers)
  response.end(data)
}

module.exports = {
  collectRequestData,
  sendResponse
}
