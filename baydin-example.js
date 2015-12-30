import { T, trace, compiler, instructionInterpreter } from './ad'

// http://arxiv.org/pdf/1502.05767.pdf

function baydinExample() {
  var t = new T()
  var x1 = t.scalar('x1')
  var x2 = t.scalar('x2')
  var f = t.sub(t.add(t.ln(x1),
		      t.mul(x1, x2)),
		t.sin(x2))
  // console.log(util.inspect(f, 0, 5))

  // first, interprete
  var tr = new trace()
  tr.bind(x1, 2)
  tr.bind(x2, 5)
  tr.eval(f)
  var vars = new Set([x1.id, x2.id])
  tr.derive(f, vars)
  
  // then compile
  var c = new compiler(t)
  c.compileValue(f)
  c.compileDerivation(f)

  // and run the instructions
  console.log('\nrun the instructions')
  var ip = new instructionInterpreter(c.instructions)
  ip.setValue(x1, 2)
  ip.setValue(x2, 5)
  ip.run()
}

baydinExample()
