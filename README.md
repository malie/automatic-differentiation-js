

build and run with:

   mkdir build
   babel . -d build --ignore build --retain-lines
   (cd build; node polynom.js)

and to run test.html in the browser

   babel . -d build --ignore build --retain-lines
   browserify -o build/bundle.js build/ad.js build/autoencoder-example.js

