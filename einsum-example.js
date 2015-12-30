import { T, trace, compiler, instructionInterpreter } from './ad'
var util = require('util')

function someEinsumExample() {
  var t = new T()
  var input = t.tensor('input', [6, 3])
  var filters = t.tensor('filters', [4, 3])
  var f = t.frobenius(t.einsum('ac,bc->ab', input, filters))

  var ix = [[1,0,0], [0,1,0], [0,0,1], [1,1,0], [0,1,1], [1,0,1]]
  var fx = [[1.0, 0.1, 0.1], [0.2, 0.7, 0.5],
	    [0, 0.7, 0.8], [0.3, 0.3, 0.9]]
  
  console.log(util.inspect(f, 0, 5))
  if (1) {
    // interprete
    var tr = new trace()
    tr.bind(input, ix)
    tr.bind(filters, fx)
    tr.eval(f)
    var vars = new Set([input.id, filters.id])
    tr.derive(f, vars)}
  else {
    // compile
    var c = new compiler(t)
    c.compileValue(f)
    c.compileDerivation(f)

    var ip = new instructionInterpreter(c.instructions)
    ip.setValue(x1, 3.000000)
    ip.setValue(x2, 0.7)
    ip.setValue(x3, 0.3)
    ip.setValue(x4, 0.2)
    ip.setValue(x5, 0.8)
    ip.run()}
    
}


someEinsumExample()
