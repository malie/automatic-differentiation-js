import numpy
import theano
import theano.tensor as T
import random

def randint(n):
    return random.randint(0, n-1)

def generateData(minibatchSize, dataSize):
    res = []
    for b in range(minibatchSize):
        start = randint(round(dataSize*0.7))
        len = 1 + randint(max(round(dataSize*0.4),
                              dataSize-start-1))
        d = []
        for i in range(dataSize):
            if i >= start and i < start+len:
                d.append(1.0)
            else:
                d.append(0)
        res.append(d)
    b = numpy.array(res)
    return b

class ae(object):
    def __init__(self, rng, minibatchSize, dataSize, numFilters):
        self.rng = rng
        self.minibatchSize = minibatchSize
        self.dataSize = dataSize
        self.numFilters = numFilters
        self.initial_filters = numpy.asarray(
                rng.uniform(
                    low=-0.03,
                    high=0.03,
                    size=(dataSize, numFilters)))
        print(self.initial_filters)
        self.filters = theano.shared(self.initial_filters)

        self.lr = T.dscalar('lr')
        self.input = T.dmatrix('input')
        self.repr = T.nnet.sigmoid(T.dot(self.input, self.filters))
        self.recons = T.nnet.sigmoid(
            T.dot(self.repr, self.filters.T))
        self.diff = self.recons - self.input
        self.cost = T.sum(self.diff**2)
        self.grad = T.grad(self.cost, [self.filters])
        self.updates = [(self.filters,
                         self.filters - self.lr*self.grad[0])]
        self.train = theano.function(
            [self.input, self.lr],
            self.cost,
            updates=self.updates)

minibatchSize = 1000
dataSize = 11
numFilters = 10
rng = numpy.random.RandomState(123)
e = ae(rng, minibatchSize, dataSize, numFilters)
for t in range(10000):
    input = generateData(minibatchSize, dataSize)
    #print(b)
    cost = e.train(input, 0.001)
    print(cost)
    if t%100 == 99:
        print(e.filters.get_value())

