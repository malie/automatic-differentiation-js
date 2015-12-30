import { T, trace, compiler, instructionInterpreter } from './ad'
var util = require('util')

function somePolynomExample() {
  var t = new T()
  var x1 = t.scalar('x1')
  var x2 = t.scalar('x2')
  var x3 = t.scalar('x3')
  var x4 = t.scalar('x4')
  var x5 = t.scalar('x5')
  var f =
      t.add(
	x1,
	t.add(
	  t.mul(x2, x5),
	  t.add(t.mul(x3, t.mul(x5, x5)),
		t.mul(x4, t.mul(x5, t.mul(x5, x5))))))

  console.log(util.inspect(f, 0, 5))
  if (0) {
    // interprete
    var tr = new trace()
    tr.bind(x1, 3.000000)
    tr.bind(x2, 0.7)
    tr.bind(x3, 0.3)
    tr.bind(x4, 0.2)
    tr.bind(x5, 0.8)
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
