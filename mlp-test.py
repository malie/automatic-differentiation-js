import numpy as np
import theano
import theano.tensor as T
import random

def randint(n):
    return random.randint(0, n-1)

global wholeText
def readTextFile():
    global wholeText
    with open('pg76.txt', 'r') as textfile:
        wholeText = textfile.read().replace('\n', ' ').replace('\r', ' ')

global numChars, charmap, unknownChar
global characters
characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ,.:;\'"-()?! '

def initCharmap():
    global numChars, charmap, unknownChar, characters
    unknownChar = len(characters)
    numChars = len(characters)+1
    charmap = dict(zip(characters, range(len(characters))))

def lookupChar(c):
    u = c.upper()
    if u in charmap:
        return charmap[u]
    else:
        return unknownChar

def charidToChar(c):
    if c < len(characters):
        return characters[c]
    else:
        return '%'
        
def prepareMinibatch(minibatchSize, contextSize, forTraining):
    global wholeText
    inputs = np.zeros([minibatchSize, contextSize*numChars])
    outputs = np.zeros([minibatchSize], dtype=np.int32)
    inputTexts = []
    outputTexts = []
    res = []
    for b in range(minibatchSize):
        while True:
            start = randint(len(wholeText)-contextSize)
            m = start % 100 < 90
            if m != forTraining:
                continue
            for i in range(contextSize):
                ch = lookupChar(wholeText[start+i])
                inputs[b, ch] = 1
            end = start + contextSize
            outputs[b] = lookupChar(wholeText[end])
            inputTexts.append(wholeText[start:end])
            outputTexts.append(wholeText[end:end+1])
            break
    return (inputs, outputs, inputTexts, outputTexts)

class inputLayer:
    def __init__(self, numInputs):
        self.numInputs = numInputs
        self._output = T.dmatrix('input')
    def numOutputs(self):
        return self.numInputs
    def output(self):
        return self._output
    def parameters(self):
        return []

class layer(object):
    def __init__(self, below, numUnits, rng):
        self.below = below
        self.numUnits = numUnits
        self.rng = rng
        dataSize = below.numOutputs()
        self.initial_weights = np.asarray(
                rng.normal(scale=0.1,
                           size=(dataSize, numUnits)))
        self.initial_bias = np.asarray(
                rng.uniform(low=0.0, high=0.0000000001,
                            size=(numUnits)))
        self.bias = theano.shared(self.initial_bias)
        self.weights = theano.shared(self.initial_weights)
    def numOutputs(self):
        return self.numUnits
    def output(self):
        input = self.below.output()
        return T.dot(input, self.weights) + self.bias
    def parameters(self):
        return [self.weights, self.bias]
    def regularization(self, f):
        return f*(T.sum(self.weights**2, axis=None)
                  + T.sum(self.bias**2, axis=None))

class relu:
    def __init__(self, below):
        self.below = below
    def numOutputs(self):
        return self.below.numOutputs()
    def output(self):
        input = self.below.output()
        return T.maximum(0, input)
    def parameters(self):
        return []
    
class softmax:
    def __init__(self, below):
        self.below = below
    def numOutputs(self):
        return self.below.numOutputs()
    def output(self):
        input = self.below.output()
        return T.nnet.softmax(input)
    def parameters(self):
        return []

class negative_log_likelihood:
    def __init__(self, below, target):
        self.below = below
        self.target = target
    def numOutputs(self):
        return 1
    def output(self):
        input = self.below.output()
        s = self.target.shape[0]
        ch = T.log(input)[T.arange(s), self.target]
        return -T.mean(ch)
    def parameters(self):
        return []
    
def updateFunction(input, output, error, layers, lr):
    params = [p for l in layers for p in l.parameters()]
    grad = T.grad(error, params)
    updates = [(params[i], params[i] - lr*grad[i])
               for i in range(len(params))]
    return theano.function([input, output, lr],
                           error,
                           updates=updates)

def testFunction(input, output, nll, softmax, lay):
    return theano.function([input, output],
                           [nll, softmax.output(), lay.output()])

    
initCharmap()
readTextFile()
rng = np.random.RandomState(123)
contextSize = 4
input = inputLayer(contextSize*numChars)
l1 = layer(input, 400, rng)
l1o = relu(l1)
l2 = layer(l1o, 400, rng)
l2o = relu(l2)
l3 = layer(l2o, 400, rng)
l3o = relu(l3)
l4 = layer(l3o, 400, rng)
l4o = relu(l4)
l5 = layer(l4o, 400, rng)
l5o = relu(l5)
llast = layer(l5o, numChars, rng)
output = softmax(llast)
target = T.ivector('target')
nll = negative_log_likelihood(output, target).output()
rf = 0.00000001
error = (negative_log_likelihood(output, target).output()
         + l1.regularization(rf)
         + l2.regularization(rf)
         + l3.regularization(rf)
         + l4.regularization(rf)
         + llast.regularization(rf)
)


lr = T.dscalar('lr')
func = updateFunction(
    input.output(),
    target,
    error,
    [l1, l2, l3, l4, llast],
    lr)

testFunc = testFunction(
    input.output(),
    target,
    nll,
    output, llast)

minibatchSize = 100

testingMinibatchSize = 1000
(testInputs, testOutputs, titxt, totxt) = prepareMinibatch(
    testingMinibatchSize,
    contextSize, False)

def r3(x):
    return round(x*1000)*0.001

trainingErrors = []
t = 0
while True:
    (inputs, outputs, it, ot) = prepareMinibatch(minibatchSize,
                                                 contextSize, True)
    err = func(inputs, outputs, 0.01)
    trainingErrors.append(err)
    if t%100 == 0:
        trainingErr = np.mean(trainingErrors)
        trainingErrors = []
        
        tres = testFunc(testInputs, testOutputs)
        err = tres[0]
        print(t, 'testing:', r3(err), 'training:', r3(trainingErr))
        # lo = tres[2]
        # print(lo[0,::])
        # print(lo[1,::])
        # print(lo[2,::])
        sm = tres[1]
        smo = np.argsort(sm, axis=1)[:, ::-1]
        for m in range(50):
            print(titxt[m], totxt[m],
                  [charidToChar(smo[m,p]) + " {:9.7f}".format(sm[m, smo[m,p]])
                   for p in range(5)])
    t += 1
