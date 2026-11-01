const { test } = require('node:test')
const assert = require('node:assert/strict')
const { classifyWindowsProduct } = require('../installation-manager/compatibility.cjs')

function windows({ caption = 'Microsoft Windows 11 Pro', productName = 'Windows 11 Pro', editionID = 'Professional', productType = 1 } = {}) {
  return { available: true, osCaption: caption, productName, editionID, productType, osBuild: '26100' }
}

test('Manager keeps Desktop as the default workstation target and selects Server automatically', () => {
  assert.equal(classifyWindowsProduct(windows()).id, 'desktop')
  assert.equal(classifyWindowsProduct(windows({
    caption: 'Microsoft Windows Server 2025 Datacenter',
    productName: 'Windows Server 2025 Datacenter',
    editionID: 'ServerDatacenter',
    productType: 3,
  })).id, 'cylinder-server')
})

test('Manager permits Cylinder Client on supported Windows 10/11 workstation editions', () => {
  for (const edition of [
    { productName: 'Windows 10 Home', editionID: 'Core' },
    { productName: 'Windows 11 Pro', editionID: 'Professional' },
    { productName: 'Windows 11 Enterprise', editionID: 'Enterprise' },
    { productName: 'Windows 11 Education', editionID: 'Education' },
  ]) {
    const result = classifyWindowsProduct(windows(edition), 'cylinder-client')
    assert.equal(result.id, 'cylinder-client')
    assert.equal(result.installAllowed, true)
    assert.equal(result.releaseCheckAllowed, true)
    assert.match(result.productName, /Cylinder Client/)
  }
})

test('Manager blocks Cylinder Client on Server, unsupported Windows, and unavailable system checks', () => {
  const server = windows({
    caption: 'Microsoft Windows Server 2025 Datacenter',
    productName: 'Windows Server 2025 Datacenter',
    editionID: 'ServerDatacenter',
    productType: 3,
  })
  assert.equal(classifyWindowsProduct(server, 'cylinder-client').installAllowed, false)
  assert.equal(classifyWindowsProduct(windows({
    caption: 'Microsoft Windows 8.1 Pro',
    productName: 'Windows 8.1 Pro',
    editionID: 'Professional',
  }), 'cylinder-client').installAllowed, false)
  assert.equal(classifyWindowsProduct({ available: false }, 'cylinder-client').installAllowed, false)
})
