import { T, trace, compiler, instructionInterpreter } from './ad'
var util = require('util')

function somePolynomExample() {
  var t = new T()
  var x1 = t.vector('x1')
  var x2 = t.vector('x2')
  var f = t.dot(x1, x2)

  console.log(util.inspect(f, 0, 5))
  if (1) {
    // interprete
    var tr = new trace()
    tr.bind(x1, [0.1, 0.4, 0.2])
    tr.bind(x2, [5, 4, 3])
    tr.eval(f)
    var vars = new Set([x1.id, x2.id])
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


somePolynomExample()
