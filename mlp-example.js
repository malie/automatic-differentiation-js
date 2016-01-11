import { T, trace, compiler, instructionInterpreter,
	 randomTensor, mapTensor, zipTensor,
	 asmjsCompiler } from './ad'
var util = require('util')
var fs = require('fs')

function randint(n) {
  return Math.floor(Math.random()*n)}


var text = null
function readText() {
  var content = fs.readFileSync('../pg76.txt')
  text = content.toString()}

var Acc = 'A'.charCodeAt(0)
var acc = 'a'.charCodeAt(0)
var zcc = 'z'.charCodeAt(0)


var charmap = null
var unknownChar = null
var numChars = null

function initCharmap() {
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ \n\r,.:;\'"-()?! '
  charmap = {}
  var i = 0
  for (var c of Array.from(characters))
    charmap[c] = i++
  unknownChar = i++
  numChars = i
  console.log('num chars:', numChars)
}

function encodeChar(c) {
  var x = charmap[c]
  if (typeof x == 'number')
    return x
  else
    return unknownChar}

function prepareMinibatch(minibatchSize, contextSize, forTraining) {
  var inputs = []
  var outputs = []
  while (1) {
    var start = randint(text.length-contextSize)
    // reserve last 10 chars in each 100 char block for testing data
    // that's never seen in training.
    var tt = start % 100 < 90
    if (!!forTraining != tt)
      continue
    var snippet = text.slice(start, start+contextSize).toUpperCase()
    var target = text[start+contextSize].toUpperCase()
    var cs = Array.from(snippet).map(c => encodeChar(c))
    var t = encodeChar(target)

    var input = new Float64Array(numChars*contextSize)
    input.fill(0.0)
    for (var i = 0; i < cs.length; i++)
      input[numChars*i + cs[i]] = 1.0
    inputs.push(input)

    var output = new Float64Array(numChars)
    output.fill(0.0)
    output[t] = 1.0
    outputs.push(output)
      
    if (inputs.length == minibatchSize)
      return {outputs: outputs, inputs: inputs}}}


function genNoise(minibatchSize, dataSize, noiseLevel) {
  var nl = 2*noiseLevel - 1.0
  return mapTensor(
    randomTensor([minibatchSize, dataSize], 1.0),
    (x) => x > nl ? 1.0 : 0.0)}

class inputLayer {
  constructor(t, minibatchSize, numInputs) {
    this.minibatchSize = minibatchSize
    this.numInputs = numInputs
    this.input = t.tensor('input', [minibatchSize, numInputs])}
  numOutputs() {
    return this.numInputs}
  output() {
    return this.input}
}

class layer {
  constructor(t, minibatchSize, below, numUnits) {
    this.t = t
    this.minibatchSize = minibatchSize
    this.below = below
    this.numUnits = numUnits
    var numInputs = below.numOutputs()
    this.weights = t.tensor('weights', [numUnits, numInputs])
    this.weightsT = randomTensor([numUnits, numInputs], 0.01)
    this.bias = t.tensor('bias', [numUnits])
    this.biasT = randomTensor([numUnits], 0.01)

    var ones = t.ones([minibatchSize, numUnits])
    this.act = t.add(
      t.einsum('ac,bc->ab', below.output(), this.weights),
      t.einsum('b,ab->ab', this.bias, ones))
    this._output = t.max0(this.act)}
  numOutputs() {
    return this.numUnits}
  output() {
    return this._output}
}

function someMLPExample() {
  var interpreted = true
  
  var t = new T()
  var minibatchSize = 10
  var contextSize = 2
  var dataSize = numChars * contextSize
  var learnRate = 0.01

  var input = new inputLayer(t, minibatchSize, dataSize)
  var l1 = new layer(t, minibatchSize, input, 50)
  var l2 = new layer(t, minibatchSize, l1, 50)
  var l3 = new layer(t, minibatchSize, l2, 50)
  var output = new softmaxLayer(minibatchSize, l3)
  var loss = new crossEntropy(minibatchSize, output)
  // negated sum of logarithms of expected outputs

  console.log(util.inspect(err, 0, 10))
  var tr = null
  if (!interpreted) {
    var comp = new asmjsCompiler(t)
    tr = comp.compile(err, [filters, biasa, biasb])}
  var count = 0;
  while (1) {
    var data = prepareMinibatch(minibatchSize, contextSize, true)
    var start = +new Date()
    
    if (interpreted)
      tr = new trace()
    
    tr.bind(origInput, data)
    tr.bind(filters, filtersT)
    tr.bind(biasa, biasaT)

    if (interpreted) {
      tr.eval(err)
      var vars = new Set([filters.id])
      tr.derive(err, vars)}
    else
      tr.call()

    var end = +new Date()
    var spent = end - start

    filtersT = zipTensor(filtersT,
    			 tr.adjointForId(filters.id),
    			 (a,b) => a-learnRate*b)
    biasaT = zipTensor(biasaT,
    		       tr.adjointForId(biasa.id),
    		       (a,b) => a-learnRate*b)
    biasbT = zipTensor(biasbT,
    		       tr.adjointForId(biasb.id),
    		       (a,b) => a-learnRate*b)

    if (Math.random() < 0.1 || count < 20 || nl === 0)
      console.log(count, 'err', tr.valueForId(err.id), spent)

    // if (count % 2000 === 1999) {
    //   console.log(filtersT)
    //   console.log(biasaT)
    //   console.log(biasbT)}
      
    if (count++ == 10000)
      break}}


initCharmap()
someMLPExample()
