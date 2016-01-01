"use strict";
var assert = require('assert')
var util = require('util')

var verbose = 0

export class T {
  constructor() {
    this.nextFreeId = 0}
  nextId() {
    return this.nextFreeId++}
  scalar(nm) {
    return new scalar(this.nextId(), nm)}
  neg(x) {
    return new neg(this.nextId(), x)}
  add(x,y) {
    return new add(this.nextId(), x, y)}
  sub(x,y) {
    return new sub(this.nextId(), x, y)}
  mul(x,y) {
    return new mul(this.nextId(), x, y)}
  div(x,y) {
    return new div(this.nextId(), x, y)}
  sin(x) {
    return new sin(this.nextId(), x)}
  cos(x) {
    return new cos(this.nextId(), x)}
  ln(x) {
    return new ln(this.nextId(), x)}

  vector(x) {
    return new vector(this.nextId(), x)}
  dot(x, y) {
    return new dot(this.nextId(), x, y)}

  tensor(nm, shape) {
    return new tensor(this.nextId(), nm, shape)}
  einsum(spec, a) {
    var tensors = Array.from(arguments).slice(1)
    return new einsum(this.nextId(), spec, tensors)}
  frobenius(t) {
    return new frobenius(this.nextId(), t)}
  squaredSum(t) {
    return new squaredSum(this.nextId(), t)}
  sigmoid(t) {
    return new sigmoid(this.nextId(), t)}
}


class scalar {
  constructor(id, nm) {
    this.id = id
    this.name = nm}
  evalInTrace(tr) {
    return tr.valueForId(this.id)}
  evalAdjointsInTrace(tr) {}
  toString() {
    return '(scalar ' + this.name + ')'}
  valueVar(c) {
    return c.valueVar(this)}
  compileValue(c) {}
  compileAdjointsWith(c) {}}

class vector {
  constructor(id, nm) {
    this.id = id
    this.name = nm}
  evalInTrace(tr) {
    return tr.valueForId(this.id)}
  evalAdjointsInTrace(tr) {}
  toString() {
    return '(vector ' + this.name + ')'}
  valueVar(c) {
    return c.valueVar(this)}
  compileValue(c) {}
  compileAdjointsWith(c) {}}

class tensor {
  constructor(id, nm, shape) {
    this.id = id
    this.name = nm
    this._shape = shape}
  accept(v) {
    v.visitTensor(this)}
  shape() {
    return this._shape}
  evalInTrace(tr) {
    return tr.valueForId(this.id)}
  evalAdjointsInTrace(tr) {}
  toString() {
    return '(tensor ' + this.name + ')'}
  valueVar(c) {
    return c.valueVar(this)}
  compileValue(c) {}
  compileAdjointsWith(c) {}}

class constant {
  constructor(value) {
    this.value = value}
  toString() {
    return 'constant ' + this.value}
  valueVar(c) {
    return this}
  runWith(ip) {
    return this.value}}
  

class unary {
  constructor(id, x) {
    this.id = id
    this.x = x}
  evalInTrace(tr) {
    var xv = tr.eval(this.x)
    return this.evaluateUnary(xv)}
  runWith(ip) {
    var xv = this.x.runWith(ip)
    return this.evaluateUnary(xv)}
  compileValue(c) {
    c.compileValue(this.x)
    c.emitAssignment(c.valueVar(this),
		     this.cloneForOperands(c.t,
					   this.x.valueVar(c)))}
  valueVar(c) {
    return c.valueVar(this)}
  toString() {
    return ('('
	    + this.shortString() + ' '
	    + this.x.toString()
	    + ')')}}
  
class binary {
  constructor(id, x, y) {
    this.id = id
    this.x = x
    this.y = y}
  evalInTrace(tr) {
    var xv = tr.eval(this.x)
    var yv = tr.eval(this.y)
    return this.evaluateBinary(xv, yv)}
  runWith(ip) {
    var xv = this.x.runWith(ip)
    var yv = this.y.runWith(ip)
    return this.evaluateBinary(xv, yv)}
  valueVar(c) {
    return c.valueVar(this)}
  compileValue(c) {
    c.compileValue(this.x)
    c.compileValue(this.y)
    c.emitAssignment(c.valueVar(this),
		     this.cloneForOperands(c.t,
					   this.x.valueVar(c),
					   this.y.valueVar(c)))}
  toString() {
    return ('('
	    + this.shortString() + ' '
	    + this.x.toString() + ' '
	    + this.y.toString()
	    + ')')}}


class nary {
  constructor(id, args) {
    this.id = id
    this.args = args}
  evalInTrace(tr) {
    var vs = this.args.map((a) => tr.eval(a))
    return this.evaluateNary(vs)}
  runWith(ip) {
    var vs = this.args.map((a) => a.runWith(ip))
    return this.evaluateNary(vs)}
  valueVar(c) {
    return c.valueVar(this)}
  compileValue(c) {
    for (var a of this.args)
      c.compileValue(a)
    var vs = this.args.map((a) => a.valueVar(c))
    c.emitAssignment(c.valueVar(this),
		     this.cloneForOperands(c.t, vs))}
  toString() {
    return ('('
	    + this.shortString() + ' '
	    + this.args.map((a) => a.toString()).join(' ') + ' '
	    + ')')}}

class add extends binary {
  shortString() { return 'add'}
  evaluateBinary(x, y) {
    return x+y}
  evalAdjointsInTrace(tr) {
    var o = tr.adjointForId(this.id)
    tr.addAdjoint(this.x, o)
    tr.addAdjoint(this.y, o)
    this.x.evalAdjointsInTrace(tr)
    this.y.evalAdjointsInTrace(tr)}
  cloneForOperands(t, x, y) {
    return t.add(x, y)}
  compileAdjointsWith(c) {
    var o = c.adjointVar(this)
    c.emitAdjointAdd(this.x, o)
    c.emitAdjointAdd(this.y, o)
    this.x.compileAdjointsWith(c)
    this.y.compileAdjointsWith(c)}}

class sub extends binary {
  shortString() { return 'sub'}
  accept(v) {
    v.preBinary(this)
    v.visitSub(this)
    v.postBinary(this)}
  evaluateBinary(x, y) {
    if (typeof x == 'number' && typeof y == 'number')
      return x-y
    else
      return zipTensor(x, y, function (a,b) { return a-b})}
  shape() {
    return this.x.shape()}
  evalAdjointsInTrace(tr) {
    var o = tr.adjointForId(this.id)
    if (typeof o == 'number') {
      tr.addAdjoint(this.x, o)
      tr.addAdjoint(this.y, -o)}
    else {
      tr.addTensorAdjoint(this.x, o)
      tr.addTensorAdjoint(this.y,
			  mapTensor(o, (x) => -x))}
    this.x.evalAdjointsInTrace(tr)
    this.y.evalAdjointsInTrace(tr)}
  cloneForOperands(t, x, y) {
    return t.sub(x, y)}
  compileAdjointsWith(c) {
    var o = c.adjointVar(this)
    c.emitAdjointAdd(this.x, o)
    c.emitAdjointAdd(this.y, c.t.neg(o))
    this.x.compileAdjointsWith(c)
    this.y.compileAdjointsWith(c)}}

class mul extends binary {
  shortString() { return 'mul'}
  evaluateBinary(x, y) {
    return x*y}
  evalAdjointsInTrace(tr) {
    var o = tr.adjointForId(this.id)
    var xv = tr.valueForId(this.x.id)
    var yv = tr.valueForId(this.y.id)
    tr.addAdjoint(this.x, o*yv)
    tr.addAdjoint(this.y, o*xv)
    this.x.evalAdjointsInTrace(tr)
    this.y.evalAdjointsInTrace(tr)}
  cloneForOperands(t, x, y) {
    return t.mul(x, y)}
  compileAdjointsWith(c) {
    var o = c.adjointVar(this)
    var xv = c.valueVar(this.x)
    var yv = c.valueVar(this.y)
    c.emitAdjointAdd(this.x, c.t.mul(o, yv))
    c.emitAdjointAdd(this.y, c.t.mul(o, xv))
    this.x.compileAdjointsWith(c)
    this.y.compileAdjointsWith(c)}}

class div extends binary {
  shortString() { return 'div'}
  evaluateBinary(x, y) {
    return x/y}
  evalAdjointsInTrace(tr) {
    throw '?'}
  cloneForOperands(t, x, y) {
    return t.div(x, y)}}


class neg extends unary {
  shortString() { return 'neg'}
  evaluateUnary(x) {
    return -x}
  evalAdjointsInTrace(tr) {
    throw '?'}
  cloneForOperands(t, x) {
    return t.neg(x)}}

class sin extends unary {
  shortString() { return 'sin'}
  evaluateUnary(x) {
    return Math.sin(x)}
  evalAdjointsInTrace(tr) {
    var o = tr.adjointForId(this.id)
    var v = tr.valueForId(this.x.id)
    tr.addAdjoint(this.x, o*Math.cos(v))
    this.x.evalAdjointsInTrace(tr)}
  cloneForOperands(t, x) {
    return t.sin(x)}
  compileAdjointsWith(c) {
    var o = c.adjointVar(this)
    var v = c.valueVar(this.x)
    c.emitAdjointAdd(this.x, c.t.mul(o, c.t.cos(v)))
    this.x.compileAdjointsWith(c)}}

class cos extends unary {
  shortString() { return 'cos'}
  evaluateUnary(x) {
    return Math.cos(x)}
  evalAdjointsInTrace(tr) {
    throw '?'}
  cloneForOperands(t, x) {
    return t.cos(x)}
  compileAdjointsWith(c) {
    throw '?'}}

class ln extends unary {
  shortString() { return 'ln'}
  evaluateUnary(x) {
    return Math.log(x)}
  evalAdjointsInTrace(tr) {
    var o = tr.adjointForId(this.id)
    var v = tr.valueForId(this.x.id)
    tr.addAdjoint(this.x, o*1/v)
    this.x.evalAdjointsInTrace(tr)}
  cloneForOperands(t, x) {
    return t.ln(x)}
  compileAdjointsWith(c) {
    var o = c.adjointVar(this)
    var v = c.valueVar(this.x)
    c.emitAdjointAdd(this.x, c.t.div(o, v))
    this.x.compileAdjointsWith(c)}}


class dot extends binary {
  shortString() { return 'dot'}
  evaluateBinary(x, y) {
    assert(x.length === y.length)
    var sum = 0
    for (var i = 0; i < x.length; i++)
      sum += x[i] * y[i]
    return sum}
  evalAdjointsInTrace(tr) {
    var o = tr.adjointForId(this.id)
    var xv = tr.valueForId(this.x.id)
    var yv = tr.valueForId(this.y.id)
    function mulo(z) { return o*z }
    tr.addVectorAdjoint(this.x, yv.map(mulo))
    tr.addVectorAdjoint(this.y, xv.map(mulo))
    this.x.evalAdjointsInTrace(tr)
    this.y.evalAdjointsInTrace(tr)}
  cloneForOperands(t, x, y) {
    return t.dot(x, y)}
  compileAdjointsWith(c) {
    throw 'todo'
    var o = c.adjointVar(this)
    var xv = c.valueVar(this.x)
    var yv = c.valueVar(this.y)
    c.emitAdjointAdd(this.x, c.t.mul(o, yv))
    c.emitAdjointAdd(this.y, c.t.mul(o, xv))
    this.x.compileAdjointsWith(c)
    this.y.compileAdjointsWith(c)}}

class einsum extends nary {
  constructor(id, spec, tensors) {
    super(id, tensors)
    this.spec = spec
    this.parseSpec()
    this.checkShape()}
  accept(v) {
    v.preNary(this)
    v.visitEinsum(this)
    v.postNary(this)}
  parseSpec() {
    var a = this.spec.split('->')
    assert(a.length === 2)
    var inputs = a[0].split(',')
    assert(inputs.length === this.args.length)
    this.inputs = inputs
    this.outputs = a[1]}
  checkShape() {
    this.dimensions = {}
    for (var i in this.inputs) {
      var input = this.inputs[i]
      var t = this.args[i]
      var sh = t.shape()
      for (var li in input) {
	let letter = input[li]
	let size = sh[li]
	if (letter in this.dimensions)
	  assert.equal(this.dimensions[letter], size)
	else
	  this.dimensions[letter] = size}}
    var odims = []
    for (var oi in this.outputs) {
      let letter = this.outputs[oi]
      let size = this.dimensions[letter]
      odims.push(size)}
    this._shape = odims}
  shape() {
    return this._shape}
  shortString() { return 'einsum'}
  nonOutputVars() {
    var res = []
    var outputsSet = new Set(this.outputs)
    for (var v in this.dimensions)
      if (!outputsSet.has(v))
	res.push(v)
    return res}
  evaluateNary(evaluatedArgs) {
    var dimensions = this.dimensions
    var shape = this._shape
    var outputs = this.outputs
    var inputs = this.inputs

    var res = zerosTensor(this._shape)
    var sum = 0.0
    
    var lo = new looper()
    for (var oi = 0; oi < outputs.length; oi++)
      lo.pushLoop(outputs[oi], shape[oi])
    lo.pushPreCallback(function (cur) {
      sum = 0.0})
    lo.pushPostCallback(function (cur) {
      tensorStoreX(res, outputs, cur, sum)})
    for (var v of this.nonOutputVars())
      lo.pushLoop(v, this.dimensions[v])
    lo.pushCallback(function (cur) {
      var prod = 1.0
      for (var ii in inputs) {
	var input = inputs[ii]
	var t = evaluatedArgs[ii]
	prod *= tensorFetchX(t, input, cur)}
      sum += prod})
    lo.run()
    return res}
  
  evalAdjointsInTrace(tr) {
    var o = tr.adjointForId(this.id)
    var as = this.args.map((t) => tr.valueForId(t.id))

    var dimensions = this.dimensions
    var shape = this._shape
    var outputs = this.outputs
    var inputs = this.inputs

    var res = this.args.map((t) => zerosTensor(t.shape()))

    var lo = new looper()
    for (var oi = 0; oi < outputs.length; oi++)
      lo.pushLoop(outputs[oi], shape[oi])
    for (var v of this.nonOutputVars())
      lo.pushLoop(v, this.dimensions[v])
    var factors = new Array(inputs.length)
    lo.pushCallback(function (cur) {
      for (var ii in inputs)
	factors[ii] = tensorFetchX(as[ii], inputs[ii], cur)
      for (var ii in inputs) {
	var prod = 1.0
	for (var j in inputs) {
	  if (j !== ii)
	    prod *= factors[j]}
	prod *= tensorFetchX(o, outputs, cur)
	tensorIncrementX(res[ii], inputs[ii], cur, prod)}})
    lo.run()

    for (var ii in inputs)
      tr.addTensorAdjoint(this.args[ii], res[ii])
    for (var ii in inputs)
      this.args[ii].evalAdjointsInTrace(tr)
  }
    
  cloneForOperands(t, x, y) {
    throw 'todo'
    return t.dot(x, y)}
  compileAdjointsWith(c) {
    throw 'todo'
    var o = c.adjointVar(this)
    var xv = c.valueVar(this.x)
    var yv = c.valueVar(this.y)
    c.emitAdjointAdd(this.x, c.t.mul(o, yv))
    c.emitAdjointAdd(this.y, c.t.mul(o, xv))
    this.x.compileAdjointsWith(c)
    this.y.compileAdjointsWith(c)}}

class looper {
  constructor() {
    this.cur = {}
    this.loops = []}
  pushLoop(variable, end) {
    this.loops.push({variable: variable, end: end})}
  pushCallback(f) {
    this.pushPreCallback(f)}
  pushPreCallback(f) {
    this.loops.push({preCallback: f})}
  pushPostCallback(f) {
    this.loops.push({postCallback: f})}
  run() {
    var loops = this.loops
    var cur = this.cur;
    function loop(i) {
      if (i === loops.length)
	return
      var l = loops[i]
      if (l.preCallback) {
	l.preCallback(cur)
	loop(i+1)}
      if (l.postCallback) {
	loop(i+1)
	l.postCallback(cur)}
      if (l.variable) {
	var v = l.variable
	var end = l.end
	for (var c = 0; c < end; c++) {
	  cur[v] = c
	  loop(i+1)}
	delete cur[v]}}
    loop(0)}}

class frobenius extends unary {
  shortString() { return 'frobenius'}
  evaluateUnary(t) {
    var sum = 0.0
    function desc(tt) {
      for (var x of tt) {
	if (typeof x == 'number')
	  sum += x*x
	else
	  desc(x)}}
    desc(t)
    return Math.sqrt(sum)}
  
  evalAdjointsInTrace(tr) {
    var o = tr.adjointForId(this.id)
    var mv = tr.valueForId(this.id)
    assert(typeof o == 'number')
    assert(typeof mv == 'number')
    var tv = tr.valueForId(this.x.id)
    var f = 0.5 / mv
    tr.addTensorAdjoint(this.x, mapTensor(tv, (v) => (o*2*v*f)))
    this.x.evalAdjointsInTrace(tr)}
  cloneForOperands(t, x) {
    return t.frobenius(x)}
  compileAdjointsWith(c) {
    throw 'todo'}}

class squaredSum extends unary {
  shortString() { return 'squaredSum'}
  accept(v) {
    v.preUnary(this)
    v.visitSquaredSum(this)
    v.postUnary(this)}
  evaluateUnary(t) {
    var sum = 0.0
    function desc(tt) {
      for (var x of tt) {
	if (typeof x == 'number')
	  sum += x*x
	else
	  desc(x)}}
    desc(t)
    return sum}
  
  evalAdjointsInTrace(tr) {
    var o = tr.adjointForId(this.id)
    var mv = tr.valueForId(this.id)
    assert(typeof o == 'number')
    assert(typeof mv == 'number')
    var tv = tr.valueForId(this.x.id)
    tr.addTensorAdjoint(this.x,
			mapTensor(tv, (v) => (o*2*v)))
    this.x.evalAdjointsInTrace(tr)}
  cloneForOperands(t, x) {
    return t.squaredSum(x)}
  compileAdjointsWith(c) {
    throw 'todo'}}


class sigmoid extends unary {
  shortString() { return 'sigmoid'}
  accept(v) {
    v.preUnary(this)
    v.visitSigmoid(this)
    v.postUnary(this)}
  shape() {
    return this.x.shape()}
  evaluateUnary(t) {
    function sig(x) {
      return 1.0 / (1.0 + Math.exp(-x))}
    if (typeof t == 'number')
      return sig(t)
    else
      return mapTensor(t, sig)}
  
  evalAdjointsInTrace(tr) {
    var o = tr.adjointForId(this.id)
    var tv = tr.valueForId(this.id)
    if (typeof tv == 'number')
      throw 'todo: scalar'
    tr.addTensorAdjoint(this.x,
			zipTensor(tv, o, (v, w) => w*v*(1.0-v)))
    this.x.evalAdjointsInTrace(tr)}
  cloneForOperands(t, x) {
    return t.frobenius(x)}
  compileAdjointsWith(c) {
    throw 'todo'}}


// Arrays of Arrays Tensor Implementation

export function zerosTensor(shape) {
  if (shape.length === 1) {
    var l = shape[0]
    var res = new Array(l)
    for (var i = 0; i < l; i++)
      res[i] = 0.0
    return res}
  else {
    var l = shape[0]
    var restShape = shape.slice(1)
    var res = new Array(l)
    for (var i = 0; i < l; i++)
      res[i] = zerosTensor(restShape)
    return res}}

export function generateTensor(shape, f) {
  if (shape.length === 1) {
    var l = shape[0]
    var res = new Array(l)
    for (var i = 0; i < l; i++)
      res[i] = f()
    return res}
  else {
    var l = shape[0]
    var restShape = shape.slice(1)
    var res = new Array(l)
    for (var i = 0; i < l; i++)
      res[i] = generateTensor(restShape, f)
    return res}}

export function randomTensor(shape, amp) {
  return generateTensor(shape,
			function () {
			  return Math.random()*2*amp-amp})}

function tensorFetchX(t, dimNames, s) {
  for (var d of dimNames) {
    t = t[s[d]]}
  return t}

function tensorStoreX(t, dimNames, s, value) {
  var l = dimNames.length
  for (var d of dimNames.slice(0, l-1))
    t = t[s[d]]
  t[s[dimNames[l-1]]] = value}

function tensorIncrementX(t, dimNames, s, value) {
  var l = dimNames.length
  for (var d of dimNames.slice(0, l-1))
    t = t[s[d]]
  t[s[dimNames[l-1]]] += value}

export function mapTensor(t, f) {
  function desc(tt) {
    var res = []
    for (var x of tt) {
      if (typeof x == 'number')
	res.push(f(x))
      else
	res.push(desc(x))}
    return res}
  return desc(t)}

export function zipTensor(a, b, f) {
  function desc(u, v) {
    var res = []
    assert(u.length === v.length)
    for (var i = 0; i < u.length; i++) {
      var ux = u[i]
      var vx = v[i]
      if (typeof vx == 'number')
	assert(typeof ux == 'number')
      if (typeof ux == 'number') {
	assert(typeof vx == 'number')
	res.push(f(ux, vx))}
      else
	res.push(desc(ux, vx))}
    return res}
  return desc(a, b)}



export class trace {
  constructor() {
    this.values = []
    this.adjoints = []}
  bind(variable, value) {
    assert(variable.id !== undefined)
    verbose &&
      console.log('binding id', variable.id, 'to', value)
    this.values[variable.id] = value}
  hasValueForId(id) {
    return id in this.values}
  valueForId(id) {
    var res = this.values[id];
    if (res === undefined) {
      console.log('no value for id', id)
      assert(false)}
    return res}
  eval(expr) {
    if (this.hasValueForId(expr.id))
      return this.valueForId(expr.id)
    var res = expr.evalInTrace(this)
    this.bind(expr, res)
    return res}

  addAdjoint(variable, value) {
    assert(variable.id !== undefined)
    var o = 0
    if (variable.id in this.adjoints)
      o = this.adjoints[variable.id]
    this.adjoints[variable.id] = o + value
    verbose &&
      console.log('adding', value, 'to adjoint', variable.id,
		  '->', o+value)}
  addVectorAdjoint(variable, value) {
    assert(variable.id !== undefined)
    var r = null
    if (variable.id in this.adjoints)
      r = arrayZipWithAdd(this.adjoints[variable.id], value)
    else
      r = Array.from(value)
    this.adjoints[variable.id] = r
    verbose &&
      console.log('adding', value, 'to adjoint', variable.id,
		  '->', r)}
  addTensorAdjoint(variable, value) {
    assert(variable.id !== undefined)
    var r = null
    if (variable.id in this.adjoints)
      r = zipTensor(value, this.adjoints[variable.id],
		    (a,b) => a+b)
    else
      r = value
    this.adjoints[variable.id] = r
    if (verbose) {
      console.log('adding tensor to adjoint', variable.id)
      console.log(r)}}
  adjointForId(id) {
    var res = this.adjoints[id];
    assert(res !== undefined)
    return res}

  derive(expr, vars) {
    this.addAdjoint(expr, 1)
    expr.evalAdjointsInTrace(this)}
}

function arrayZipWithAdd(a, b) {
  assert(a.length === b.length)
  var res = new Array(a.length)
  for (var i = 0; i < a.length; i++)
    res[i] = a[i] + b[i]
  return res}

function arrayAny(ary, pred) {
  for (var x of ary)
    if (pred(x))
      return true
  return false}

class valueVar {
  constructor(id, name) {
    this.id = id
    this.name = name}
  toString() {
    return this.name || ('v_' + this.id)}
  runWith(ip) {
    return ip.getValue(this)}
  assignTo(ip, value) {
    ip.setValue(this, value)}}

class adjointVar {
  constructor(id, name) {
    this.id = id
    this.name = name}
  toString() {
    if (this.name)
      return 'ad_' + this.name
    else
      return 'ad_' + this.id}
  runWith(ip) {
    return ip.getAdjoint(this)}
  assignTo(ip, value) {
    ip.setAdjoint(this, value)}
  incrementWith(ip, value) {
    var v = value + ip.getAdjoint(this)
    ip.setAdjoint(this, v)}}

class assign {
  constructor(variable, expr) {
    this.variable = variable
    this.expr = expr}
  toString() {
    return this.variable + ' := ' + this.expr.toString()}
  runWith(ip) {
    this.variable.assignTo(ip, this.expr.runWith(ip))}}

class increment {
  constructor(variable, expr) {
    this.variable = variable
    this.expr = expr}
  toString() {
    return this.variable + ' += ' + this.expr.toString()}
  runWith(ip) {
    this.variable.incrementWith(ip, this.expr.runWith(ip))}}


export class compiler {
  constructor(t) {
    this.t = t
    this.output = []
    this.adjointSeen = new Set()
    this.instructions = []}

  emitInsn(insn) {
    this.instructions.push(insn)
    // console.log(insn.toString())
  }

  emitAssignment(dest, op) {
    this.emitInsn(new assign(dest, op))}
  
  valueVar(expr) {
    return new valueVar(expr.id, expr.name)}
  adjointVar(expr) {
    return new adjointVar(expr.id, expr.name)}

  compileValue(expr) {
    expr.compileValue(this)}
  
  compileDerivation(expr) {
    this.emitAdjointAdd(expr, new constant(1.0))
    expr.compileAdjointsWith(this)}

  emitAdjointAdd(expr, adjointExpr) {
    let v = this.adjointVar(expr)
    if (!this.adjointSeen.has(expr.id)) {
      this.emitInsn(new assign(v, adjointExpr))
      this.adjointSeen.add(expr.id)}
    else
      this.emitInsn(new increment(v, adjointExpr))}
}

export class instructionInterpreter {
  constructor(instructions) {
    this.instructions = instructions
    this.values = []
    this.adjoints = []}
  setValue(variable, value) {
    var id = variable.id
    assert(id !== undefined && typeof id === 'number')
    console.log('  setting value', id, 'to', value)
    this.values[id] = value}
  getValue(variable) {
    var id = variable.id
    assert(id !== undefined && typeof id === 'number')
    return this.values[id]}

  setAdjoint(variable, value) {
    var id = variable.id
    assert(id !== undefined && typeof id === 'number')
    console.log('  setting adjoint', id, 'to', value)
    this.adjoints[id] = value}
  getAdjoint(variable) {
    var id = variable.id
    assert(id !== undefined && typeof id === 'number')
    return this.adjoints[id]}
  
  run() {
    for (var insn of this.instructions) {
      console.log(insn.toString())
      insn.runWith(this)}}
}

export class asmjsCompiler {
  constructor(t) {
    this.idGenerator = t
    this.allocPointer = 0
    this.memoryOffsets = []
    this.shapes = []
    this.genvarId = 1
    this.vars = {}
    this.parts = []}

  nextId() {
    return this.idGenerator.nextId()}
  
  compile(expr, derivatives) {
    // console.log(util.inspect(expr, 0, 10))

    var c = new asmjsCompileValue(this)
    c.compile(expr)
    
    var di = new identifyNeededAdjoints(expr, derivatives)
    var neededAdjoints = di.find()
    
    var d = new asmjsCompileAdjoints(this, neededAdjoints)
    d.compile(expr)
    this.adjointTensorMap = d.adjointTensorMap
    return generateAsmjs(this)}
  genvar(prefix, low, high) {
    var name = (prefix || '_v') + (this.genvarId++)
    var v = {name: name}
    if (low !== undefined) v.low = low
    if (high !== undefined) v.high = high
    this.vars[name] = v;
    return v}
  allocTensor(t) {
    var sh = t.shape()
    var mem = bytesForShape(sh)
    if (this.memoryOffsets[t.id] !== undefined)
      this.memoryOffsets[t.id]

    var nm = t.shortString ? t.shortString() : t.name
    this.memoryOffsets[t.id] = this.allocPointer
    this.allocPointer += mem
    this.shapes[t.id] = sh}

  allocDouble(t) {
    var mem = 8
    if (this.memoryOffsets[t.id] !== undefined)
      this.memoryOffsets[t.id]

    var nm = t.shortString ? t.shortString() : t.name
    this.memoryOffsets[t.id] = this.allocPointer
    this.allocPointer += mem
    this.shapes[t.id] = 1}
  
  emit(x) {
    // console.log('emit')
    // console.log(util.inspect(x, 0, 10))
    this.parts.push(x)}

}

function mapObjectKeyValues(object, f) {
  var res = {}
  for (var nm in object)
    res[nm] = f(nm, object[nm])
  return res}

const bytesForDouble = 8

function shapeNumElements(shape) {
  var prod = 1
  for (var d of shape)
    prod *= d
  return prod}

// everything is double for now
function bytesForShape(shape) {
  return shapeNumElements(shape) * bytesForDouble}

class asmjsCompileValue {
  constructor(c) {
    this.compiler = c}
  compile(expr) {
    expr.accept(this)}
  emit(x) {
    this.compiler.emit(x)}
  preUnary(f) {
    // console.log(f.x)
    f.x.accept(this)}
  preBinary(f) {
    // console.log(f.x)
    f.x.accept(this)
    // console.log(f.y)
    f.y.accept(this)}
  preNary(f) {
    for (var x of f.args) {
      // console.log(x)
      x.accept(this)}}
  postUnary(f) {}
  postBinary(f) {}
  postNary(f) {}

  visitTensor(t) {
    this.compiler.allocTensor(t)}
  visitSub(f) {
    this.compiler.allocTensor(f)
    var sh = f.shape()
    var vars = sh.map((dim) => this.compiler.genvar('_d', 0, dim))
    var res = buildLoopForShape(
      vars, sh,
      buildTensorStore(f, vars,
		       buildDoubleSub(
			 buildTensorFetch(f.x, vars),
			 buildTensorFetch(f.y, vars))))
    this.emit(res)}
  visitSquaredSum(f) {
    this.compiler.allocDouble(f)
    var sh = f.x.shape()
    var vars = sh.map((dim) => this.compiler.genvar('_q', 0, dim))
    var sum = this.compiler.genvar('_sum')
    var res = buildBlock(
      [ buildDeclareDoubleVar(sum, buildDoubleConstant(0.0)),
	buildLoopForShape(
	  vars, sh,
	  buildDoubleAssignAdd(
	    sum,
	    buildDoubleSquare(buildTensorFetch(f.x, vars)))),
	buildDoubleStore(f, buildReadVar(sum))])
    this.emit(res)}
  visitSigmoid(f) {
    this.compiler.allocTensor(f)
    var sh = f.x.shape()
    var vars = sh.map((dim) => this.compiler.genvar('_s', 0, dim))
    var res = buildLoopForShape(
      vars, sh,
      buildTensorStore(f, vars,
		       buildSigmoid(
			 buildTensorFetch(f.x, vars))))
    this.emit(res)}
  
  visitEinsum(f) {
    this.compiler.allocTensor(f)
    var vars = mapObjectKeyValues(
      f.dimensions,
      (nm, dim) => this.compiler.genvar(nm, 0, dim))
    var prod = 1
    for (var i in f.inputs) {
      prod = buildDoubleMul(
	prod,
	buildTensorFetch(
	  f.args[i],
	  Array.from(f.inputs[i]).map((v) => vars[v])))}
    var sum = this.compiler.genvar('sum')
    var innerLoop = buildDoubleAssignAdd(sum, prod)
    for (var v of f.nonOutputVars())
      innerLoop = buildCountedLoop(
	vars[v], 0, f.dimensions[v], innerLoop)
    var storeVars = Array.from(f.outputs).map((v) => vars[v])
    var bl = buildBlock(
      [ buildDeclareDoubleVar(sum, buildDoubleConstant(0.0)),
	innerLoop,
	buildTensorStore(f, storeVars,
			 buildReadVar(sum))])
    for (var v of f.outputs)
      bl = buildCountedLoop(
	vars[v], 0, f.dimensions[v], bl)

    this.emit(bl)}
  
}

class identifyNeededAdjoints {
  constructor(expr, derivatives) {
    this.expr = expr
    this.derivatives = derivatives
    this.derset = new Set(derivatives.map((d) => d.id))
  }
  find() {
    this.expr.accept(this)
    return this.derset}
  isMarkedAsNeeded(variable) {
    return this.derset.has(variable.id)}
  markAsNeeded(variable) {
    if (!this.isMarkedAsNeeded(variable)) {
      // console.log('adding', variable.id,
      //             'as needed for adjoints')
      this.derset.add(variable.id)}}
  preUnary(f) {
    f.x.accept(this)
    if (this.isMarkedAsNeeded(f.x))
      this.markAsNeeded(f)}
  preBinary(f) {
    f.x.accept(this)
    if (this.isMarkedAsNeeded(f.x))
      this.markAsNeeded(f)
    f.y.accept(this)
    if (this.isMarkedAsNeeded(f.y))
      this.markAsNeeded(f)}
  preNary(f) {
    for (var x of f.args) {
      x.accept(this)
      if (this.isMarkedAsNeeded(x))
	this.markAsNeeded(f)}}
  postUnary(f) {}
  postBinary(f) {}
  postNary(f) {}
  visitTensor(t) {}
  visitSub(f) {}
  visitSquaredSum(f) {}
  visitSigmoid(f) {}
  visitEinsum(f) {}
  
}

class adjointTensor {
  constructor(id, shape) {
    this.id = id
    this._shape = shape}
  shape() {
    return this._shape}
  toString() {
    return '(adjointTensor ' + this.id + ')'}}

class adjointDouble {
  constructor(id) {
    this.id = id}
  shape() {
    throw 'needed?'
    return 1}
  toString() {
    return '(adjointDouble ' + this.id + ')'}}


class asmjsCompileAdjoints {
  constructor(c, neededAdjoints) {
    this.compiler = c

    // set of var id's that we need adjoints for
    this.neededAdjoints = neededAdjoints
    console.log(this.neededAdjoints)

    // mapping tensor or op id to adjoint tensor
    this.adjointTensorMap = new Map()
    
  }
  compile(expr) {
    // set top adjoint
    var top = this.allocAdjointDouble(expr)
    this.emit(buildDoubleStore(top, buildDoubleConstant(1.0)))
      
    expr.accept(this)}
  emit(x) {
    this.compiler.emit(x)}
  preUnary(f) {}
  preBinary(f) {}
  preNary(f) {}

  isNeeded(variable) {
    return this.neededAdjoints.has(variable.id)}
  
  postUnary(f) {
    if (this.isNeeded(f.x))
      f.x.accept(this)}
    
  postBinary(f) {
    if (this.isNeeded(f.x))
      f.x.accept(this)
    if (this.isNeeded(f.y))
      f.y.accept(this)}
  
  postNary(f) {
    for (var x of f.args) {
      if (this.isNeeded(x))
	x.accept(this)}}

  isAdjointTensorAllocated(ot) {
    return this.adjointTensorMap.has(ot.id)}
  
  getAdjointTensor(ot) {
    assert(this.isAdjointTensorAllocated(ot))
    return this.adjointTensorMap.get(ot.id)}
  
  allocAdjointTensor(ot) {
    if (this.adjointTensorMap.has(ot.id))
      return this.adjointTensorMap.get(ot.id)
    var id = this.compiler.nextId()
    var at = new adjointTensor(id, ot.shape())
    this.adjointTensorMap.set(ot.id, at)
    this.compiler.allocTensor(at)
    return at}

  allocAdjointDouble(ot) {
    if (this.adjointTensorMap.has(ot.id))
      return this.adjointTensorMap.get(ot.id)
    var id = this.compiler.nextId()
    var at = new adjointDouble(id)
    this.adjointTensorMap.set(ot.id, at)
    this.compiler.allocDouble(at)
    return at}

  emit(x) {
    // console.log(util.inspect(x, 0, 9))
    this.compiler.emit(x)}

  visitTensor(t) { }

  visitSquaredSum(f) {
    if (!this.isNeeded(f.x)) return
    var wasAllocated = this.isAdjointTensorAllocated(f.x)
    var at = this.allocAdjointTensor(f.x)
    /// console.log(f)
    var sh = f.x.shape()
    var vars = sh.map((dim) => this.compiler.genvar('_s', 0, dim))
    var o = this.compiler.genvar('_o')
    var declO = buildDeclareDoubleVar(o, buildDoubleConstant(0.0))
    var getO = buildDoubleAssign(
      o,
      buildDoubleFetch(this.getAdjointTensor(f)))
    var adjoint =
	buildDoubleMul(
	  buildDoubleConstant(2.0),
	  buildDoubleMul(buildReadVar(o),
			 buildTensorFetch(f.x, vars)))
    var body = null
    if (wasAllocated)
      body = buildTensorIncrement(at, vars, adjoint)
    else
      body = buildTensorStore(at, vars, adjoint)
    var loop = buildLoopForShape(vars, sh, body)
    this.emit(buildBlock([declO, getO, loop]))}

  visitSub(f) {
    if (!this.isNeeded(f.x) && !this.isNeeded(f.y))
      return
    var fat = this.getAdjointTensor(f)
    var sh = f.x.shape()
    var vars = sh.map((dim) => this.compiler.genvar('_s', 0, dim))
    var o = this.compiler.genvar('_o')
    var declO = buildDeclareDoubleVar(o, buildDoubleConstant(0.0))

    var getO = buildDoubleAssign(o, buildTensorFetch(fat, vars))
    var adjointX = buildReadVar(o)
    var adjointY = buildDoubleNeg(buildReadVar(o))

    
    var body = [declO, getO]
    if (this.isNeeded(f.x)) {
      var stox = null
      var wasAllocatedX = this.isAdjointTensorAllocated(f.x)
      var atx = this.allocAdjointTensor(f.x)
      if (wasAllocatedX)
	stox = buildTensorIncrement(atx, vars, adjointX)
      else
	stox = buildTensorStore(atx, vars, adjointX)
      body.push(stox)}

    if (this.isNeeded(f.y)) {
      var stoy = null
      var wasAllocatedY = this.isAdjointTensorAllocated(f.y)
      var aty = this.allocAdjointTensor(f.y)
      if (wasAllocatedY)
	stoy = buildTensorIncrement(aty, vars, adjointY)
      else
	stoy = buildTensorStore(aty, vars, adjointY)
      body.push(stoy)}

    this.emit(buildLoopForShape(vars, sh, buildBlock(body)))
  }

  visitSigmoid(f) {
    if (!this.isNeeded(f.x))
      return
    var fat = this.getAdjointTensor(f)
    var sh = f.x.shape()
    var vars = sh.map((dim) => this.compiler.genvar('_s', 0, dim))

    var o = this.compiler.genvar('_o')
    var declO = buildDeclareDoubleVar(o, buildDoubleConstant(0.0))
    var getO = buildDoubleAssign(o, buildTensorFetch(f, vars))
    
    var adjoint =
	buildDoubleMul(
	  buildTensorFetch(fat, vars),
	  buildDoubleMul(
	    buildReadVar(o),
	    buildDoubleSub(buildDoubleConstant(1.0),
			   buildReadVar(o))))
    
    var body = [declO, getO]
    var wasAllocated = this.isAdjointTensorAllocated(f.x)
    var at = this.allocAdjointTensor(f.x)
    var sto = null
    if (wasAllocated)
      sto = buildTensorIncrement(at, vars, adjoint)
    else
      sto = buildTensorStore(at, vars, adjoint)
    body.push(sto)

    this.emit(buildLoopForShape(vars, sh, buildBlock(body)))}


  visitEinsum(f) {
    if (!arrayAny(f.args, (a) => this.isNeeded(a)))
      return

    for (var ii in f.args) {
      var arg = f.args[ii]
      if (this.isNeeded(arg)) {
	var wasAllocated = this.isAdjointTensorAllocated(arg)
	var at = this.allocAdjointTensor(arg)
	if (!wasAllocated)
	  this.emit(buildClearTensor(at))}}

    var statements = []
    var dimensions = f.dimensions
    var loopvars = mapObjectKeyValues(
      f.dimensions,
      (nm, dim) => this.compiler.genvar(nm, 0, dim))
    var o = this.compiler.genvar('o')
    for (var ii in f.args) {
      var arg = f.args[ii]
      if (!this.isNeeded(arg))
	continue
      var ins = f.inputs[ii]
      var prod = buildReadVar(o)
      for (var j in f.args) {
	if (j !== ii) {
	  prod = buildDoubleMul(
	    prod,
	    buildTensorFetch(
	      f.args[j],
	      Array.from(f.inputs[j]).map((nm) => loopvars[nm])))}}
      statements.push(
	buildTensorIncrement(
	  this.getAdjointTensor(arg),
	  Array.from(f.inputs[ii]).map((nm) => loopvars[nm]),
	  prod))}

    // inner loops
    var innerLoops =
	buildLoopForShape(
	  f.nonOutputVars().map((nm) => loopvars[nm]),
	  f.nonOutputVars().map((nm) => dimensions[nm]),
	  buildBlock(statements))

    var os = Array.from(f.outputs)

    var olstatements = []
    olstatements.push(
      buildDeclareDoubleVar(o, buildDoubleConstant(0.0)))
    olstatements.push(
      buildDoubleAssign(
	o,
	buildTensorFetch(
	  this.getAdjointTensor(f),
	  os.map((nm) => loopvars[nm]))))
    olstatements.push(innerLoops)

    var outerLoops =
	buildLoopForShape(
	  os.map((nm) => loopvars[nm]),
	  os.map((nm) => dimensions[nm]),
	  buildBlock(olstatements))
    this.emit(outerLoops)}
}

function buildDoubleConstant(x) {
  assert(typeof x == 'number')
  return {op: 'doubleConstant', value: x}}

function buildDoubleAssignAdd(a, b) {
  return {op:'doubleAssignAdd', a: a, b: b}}

function buildDoubleAssign(a, b) {
  return {op:'doubleAssign', a: a, b: b}}

function buildDeclareDoubleVar(a, b) {
  return {op:'declareDoubleVar', a: a, b: b}}

function buildDoubleNeg(a) {
  return {op: 'doubleNeg', a: a}}

function buildDoubleSub(a, b) {
  return {op: 'doubleSub', a: a, b: b}}

function buildDoubleMul(a, b) {
  if (a === 1)
    return b
  if (b === 1)
    return a
  return {op: 'doubleMul', a: a, b: b}}

function buildDoubleSquare(a) {
  return {op: 'doubleSquare', a: a}}

function buildSigmoid(a) {
  return {op: 'sigmoid', a:a}}

function buildTensorFetch(t, vs) {
  return {op: 'tensorFetch',
	  tensor: t,
	  vars: vs}}

function buildTensorStore(t, vs, value) {
  return {op: 'tensorStore',
	  tensor: t,
	  vars: vs,
	  value: value}}

function buildTensorIncrement(t, vs, value) {
  return {op: 'tensorIncrement',
	  tensor: t,
	  vars: vs,
	  value: value}}

function buildClearTensor(t) {
  return {op: 'clearTensor',
	  tensor: t}}

function buildDoubleFetch(dest) {
  return {op: 'doubleFetch',
	  dest: dest}}

function buildDoubleStore(dest, value) {
  return {op: 'doubleStore',
	  dest: dest,
	  value: value}}

function buildCountedLoop(variable, start, end, body) {
  return {op:'countedLoop',
	  variable: variable,
	  start: start,
	  end: end,
	  body: body}}

function buildLoopForShape(vars, shape, body) {
  if (vars.length == 0)
    return body
  return buildCountedLoop(
    vars[0], 0, shape[0],
    buildLoopForShape(vars.slice(1), shape.slice(1), body))}
  

function buildBlock(stmts) {
  return {op: 'block', statements: stmts}}

function buildReadVar(variable) {
  return {op: 'readVar', variable: variable}}

function generateAsmjs(c) {
  var res = []
  var indent = 2
  function emit(x) {
    var ind = []
    for (var i = 0; i < indent; i++)
      ind.push('  ')
    res.push(ind.join('') + x)}

  var intvars = new Set()
  var doublevars = new Set()
  function gen(p) {
    ///// emit('/*\n' + util.inspect(p) + '*/')
    if (p.op == 'countedLoop') {
      var v = p.variable.name
      emit('for (' + v + ' = ' + p.start + '; '
	   + '(' + v + '|0) < (' + p.end + '|0); '
	   + v + '= ((' + v + '+1)|0)) {')
      intvars.add(v)
      indent++;
      gen(p.body)
      indent--;
      emit('}')}
    else if (p.op == 'block') {
      for (var part of p.statements)
	gen(part)}
    else if (p.op == 'declareDoubleVar') {
      doublevars.add(p.a.name)
      emit(p.a.name + ' =')
      indent++
      gen(p.b)
      indent--}
    else if (p.op == 'doubleAssign') {
      emit(p.a.name + ' =')
      indent++
      gen(p.b)
      indent--}
    else if (p.op == 'doubleAssignAdd') {
      emit(p.a.name + ' = +(' + p.a.name + ' + ')
      indent++
      gen(p.b)
      indent--
      emit(')')}
    else if (p.op == 'doubleConstant') {
      var s = '' + p.value
      if (s.indexOf('.') < 0)
	s += '.0'
      emit(s)}
    else if (p.op == 'doubleMul') {
      emit('+(')
      indent++
      gen(p.a)
      emit('*')
      gen(p.b)
      indent--
      emit(')')}
    else if (p.op == 'doubleSub') {
      emit('+(')
      indent++
      gen(p.a)
      emit('-')
      gen(p.b)
      indent--
      emit(')')}
    else if (p.op == 'doubleNeg') {
      emit('+(-')
      indent++
      gen(p.a)
      indent--
      emit(')')}
    else if (p.op == 'doubleSquare') {
      emit('pow(')
      indent++
      gen(p.a)
      emit(',2.0)')
      indent--}
    else if (p.op == 'tensorFetch'
	     || p.op == 'tensorStore'
	     || p.op == 'tensorIncrement') {
      var incr = p.op == 'tensorIncrement'
      var store = incr || p.op == 'tensorStore'
      var t = p.tensor
      var sh = t.shape()
      var ofs = c.memoryOffsets[t.id]
      var str = (store?'':'+') + 'fheap[(' + ofs
      var q = shapeNumElements(sh)
      for (var i in p.vars) {
	var v = p.vars[i]
	var s = sh[i]
	q /= s
	str += ' + (' + q*bytesForDouble + '*' + v.name + '|0)'}
      str += ')>>3]'
      if (store)
	str += !incr ? " = " : (' = +(' + str + ' + ')
      str +=
	' /*'
	+ (t.shortString ? t.shortString() : t.name || t.id)
	+ '*/'
      emit(str)
      if (store) {
	indent++
	gen(p.value)
	indent--
	if (incr)
	  emit(')')}}
    else if (p.op == 'clearTensor') {
      var t = p.tensor
      var ofs = c.memoryOffsets[t.id]
      var v = '_i' + t.id
      var b = bytesForDouble
      var lim = shapeNumElements(t.shape())*b
      emit('for (' + v + ' = 0; '
	   + '(' + v + '|0) < (' + lim +'|0); '
	   + v +' = (' + v + '+' + b + ')|0)')
      intvars.add(v)
      indent++;
      emit('fheap[('+ofs+'+'+v+')>>3] = 0.0')
      indent--}
    else if (p.op == 'doubleStore') {
      var ofs = c.memoryOffsets[p.dest.id]
      emit('fheap[' + ofs + '>>3] =')
      indent++
      gen(p.value)
      indent--}
    else if (p.op == 'doubleFetch') {
      var ofs = c.memoryOffsets[p.dest.id]
      emit('+fheap[' + ofs + '>>3]')}
    else if (p.op == 'readVar')
      emit(p.variable.name)
    else if (p.op == 'sigmoid') {
      emit('1.0 / (1.0 + exp(-')
      indent++
      gen(p.a)
      indent--
      emit('))')}
    else
      emit(util.inspect(p))
  }

  for (var part of c.parts)
    gen(part)

  for (var iv of intvars)
    res.unshift('    var ' + iv + ' = 0')
  for (var dv of doublevars)
    res.unshift('    var ' + dv + ' = 0.0')
  
  res.unshift("  function func() {")
  res.unshift("  var fheap = new stdlib.Float64Array(heap)")
  res.unshift('  var exp = stdlib.Math.exp')
  res.unshift('  var pow = stdlib.Math.pow')
  res.unshift("  \"use asm\";")
  res.unshift("function module(stdlib, foreign, heap) {")

  res.push("    }")
  res.push("  return {func: func}")
  res.push("}")
  res.push("module")
  res = res.join('\n')
  // console.log(res)
  return new compiledFunction(
    eval(res),
    c.shapes,
    c.memoryOffsets,
    c.allocPointer,
    c.adjointTensorMap)}

function nextPowerOfTwo(a) {
  var res = 1
  while (res < a)
    res *= 2
  return res}

class compiledFunction {
  constructor(module, shapes, memoryOffsets,
	      memoryNeed, adjointTensorMap) {
    this.module = module
    this.shapes = shapes
    this.memoryOffsets = memoryOffsets
    this.memoryNeed = memoryNeed
    this.adjointTensorMap = adjointTensorMap
    this.heap = new ArrayBuffer(nextPowerOfTwo(memoryNeed))
    this.fheap = new Float64Array(this.heap)
    var stdlib = { Math: Math,
		   Float64Array: Float64Array}
    var foreign = {}
    this.moduleInstance = this.module(stdlib, foreign, this.heap)}

  // todo: maybe rename to 'pass', as in "passing an argument"
  bind(variable, value) {
    var sh = this.shapes[variable.id]
    var ptr = this.memoryOffsets[variable.id] / bytesForDouble
    var fheap = this.fheap
    function desc(depth, x) {
      if (typeof x === 'number')
	fheap[ptr++] = x
      else {
	assert(x.length === sh[depth])
	for (var a of x)
	  desc(depth+1, a)}}
    desc(0, value)
  }

  valueForId(id) {
    var sh = this.shapes[id]
    var ptr = this.memoryOffsets[id] / bytesForDouble
    var fheap = this.fheap
    function desc(depth) {
      if (depth === sh.length)
	return fheap[ptr++]
      else {
	var l = sh[depth]
	var res = new Array()
	for (var i = 0; i < l; i++)
	  res[i] = desc(depth+1)
	return res}}
    if (sh === 1)
      return fheap[ptr]
    else
      return desc(0)}

  adjointForId(id) {
    var adj = this.adjointTensorMap.get(id)
    // console.log('adjoint for', id, ' -> ', adj)
    return this.valueForId(adj.id)}

  call() {
    this.moduleInstance.func()
  }
}

