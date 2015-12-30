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
  evaluateBinary(x, y) {
    if (typeof x == 'number' && typeof y == 'number')
      return x-y
    else
      return zipTensor(x, y, function (a,b) { return a-b})}
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

