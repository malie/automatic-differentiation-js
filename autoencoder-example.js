// todo: Biases
// todo: try generate inputs from autoencoder
//   by using the input derivatives to advantage.
//   First input is noisy, random, or just one 1

import { T, trace, compiler, instructionInterpreter,
	 randomTensor, mapTensor, zipTensor,
	 asmjsCompiler } from './ad'
var util = require('util')

function randint(n) {
  return Math.floor(Math.random()*n)}


// generate data instances with ranges of ones, like
// [ [ 0, 0, 0, 1, 1, 1, 0, 0, 0 ],
//   [ 0, 0, 1, 1, 1, 1, 1, 1, 0 ],
//   [ 0, 0, 0, 1, 1, 1, 1, 0, 0 ],
//   [ 0, 0, 0, 0, 0, 1, 1, 1, 1 ],
//   [ 0, 0, 0, 1, 1, 1, 1, 0, 0 ] ]
function generateData(minibatchSize, dataSize) {
  var res = []
  for (var b = 0; b < minibatchSize; b++) {
    var start = randint(dataSize*0.7)
    var len = 1+randint(Math.max(dataSize*0.4, dataSize-start-1))
    var d = new Array(dataSize)
    for (var i = 0; i < dataSize; i++)
      d[i] = (i >= start && i < start+len) ? 1.0 : 0.0
    res.push(d)}
  return res}

function genNoise(minibatchSize, dataSize, noiseLevel) {
  var nl = 2*noiseLevel - 1.0
  return mapTensor(
    randomTensor([minibatchSize, dataSize], 1.0),
    (x) => x > nl ? 1.0 : 0.0)}

function someAutoencoderExample() {
  var interpreted = false
  var denoising = true
  var noiseLevel = 0.4
  
  var t = new T()
  var minibatchSize = 100
  var dataSize = 100
  var numFilters = 11
  var learnRate = 0.01

  var origInput = t.tensor('input', [minibatchSize, dataSize])
  var filters = t.tensor('filters', [numFilters, dataSize])
  // var biasa = t.tensor('biasa', [numFilters])
  // var biasb = t.tensor('biasb', [dataSize])

  var noise = null
  var input = origInput
  if (denoising) {
    noise = t.tensor('noise', [minibatchSize, dataSize])
    input = t.einsum('ab,ab->ab', noise, origInput)}
  
  var act = t.einsum('ac,bc->ab', input, filters)
  var repr = t.sigmoid(act)
  var reconsAct = t.einsum('ac,cb->ab', repr, filters)
  var recons = t.sigmoid(reconsAct)
  var err = t.squaredSum(t.sub(origInput, recons))

  var filtersT = randomTensor([numFilters, dataSize], 0.03)

  console.log('num parameters:', numFilters*dataSize)
  
  var datas = []
  for (var i = 0; i < 100; i++)
    datas.push(generateData(minibatchSize, dataSize))
    
  // console.log(util.inspect(err, 0, 10))
  var tr = null
  if (!interpreted) {
    var comp = new asmjsCompiler(t)
    tr = comp.compile(err, [filters])}
  var count = 0;
  while (1) {
    var data = datas[count % datas.length]
    var start = +new Date()
    
    if (interpreted)
      tr = new trace()
    
    tr.bind(origInput, data)
    tr.bind(filters, filtersT)
    
    if (denoising) {
      var nl = noiseLevel
      if (count % 20 === 19) {
	console.log('without noise')
	nl = 0}
      var noi = genNoise(minibatchSize, dataSize, nl)
      tr.bind(noise, noi)}

    if (interpreted) {
      tr.eval(err)
      var vars = new Set([filters.id])
      tr.derive(err, vars)}
    else
      tr.call()

    // console.log('updates:')
    // console.log(tr.adjointForId(filters.id))
    
    filtersT = zipTensor(filtersT,
    			 tr.adjointForId(filters.id),
    			 (a,b) => a-learnRate*b)

    var end = +new Date()
    var spent = end - start
    console.log(count, 'err', tr.valueForId(err.id), spent)
    // if (count % 100 === 0)
    //   console.log(filtersT)
      
    if (count++ == 100000)
      break}}

someAutoencoderExample()
