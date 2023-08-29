!function(){

  // init utf8 utils
  var UTF8 = {
    enc: TextEncoder.prototype.encode.bind(new TextEncoder()),
    dec: TextDecoder.prototype.decode.bind(new TextDecoder())
  };



  // == generating ==
  var genSpace = 0;
  var genArrs = {i: 0};
  var genp = function() {
    for(let i=0; i<arguments.length; ++i)
      genArrs[genArrs.i++] = arguments[i];
    return arguments.length;
  };

  /**
   * generate part of js value
   * @param {Any} o any js value
   * @returns {Uint8Array}
   */
  function genPart(o) {
    if(o===null) return genp( new Uint8Array([110]) ) // 110==n

    // buffer
    if(o instanceof ArrayBuffer) return genp(new Uint8Array(o));
    if(o instanceof Uint8Array) return genp(o);

    // array
    if(Array.isArray(o)) {
      genp(new Uint8Array([91]));
      var l = genArrs.i;
      for(let i=0; i<o.length; ++i) 
        if(genPart(o[i])) genp(new Uint8Array([44]));
        if(genArrs.i>l) genArrs.i--;
      return genp(new Uint8Array([93]));
    }

    switch(typeof o) {

      case "string": 
        return genp( new Uint8Array([34]), UTF8.enc(o), new Uint8Array([34]) );

      case "number": 
        return genp( UTF8.enc(o.toString()) );

      case "boolean": 
        return genp( new Uint8Array([(o?116:102)]) ); // 116==t, 102==f

      case "object": {
        genp(new Uint8Array([123])); // 123=={
        var ks = Object.keys(o);
        var l = genArrs.i;
        for(let i=0; i<ks.length; ++i) {
          const k = ks[i];
          genp(UTF8.enc(k), new Uint8Array([58])); // 58==:
          if(genPart(o[k])===null) {
            genArrs.i -= 2;
            continue;
          }
          genp(new Uint8Array([44])); // 44==,
        }
        if(genArrs.i>l) genArrs.i--;
        return genp(new Uint8Array([125])); // 125==}
      }

    }
    return null;
  }

  /**
   * gen(obj, isStr)
   * generate buffer or string for internet transfers
   * similar to JSON.stringify but buffer supported
   * @param {Any} obj JS Object
   * @param {Number} space while space>0, file will be formated with specified tab size
   */
  function gen(obj, space) {
    // init generation
    genSpace = space;
    genArrs = {i: 0};
    genPart(obj);
    // concat genArrs into buffer
    var l = 0;
    for(var i=0; i<genArrs.i; ++i) l += genArrs[i].byteLength;
    var u = new Uint8Array(l);
    var o = 0;
    for(var i=0; i<genArrs.i; ++i) u.set(genArrs[i],o)||(o+=genArrs[i].byteLength);
    u.toString = ()=> UTF8.dec(r);
    return u;
  };



  // == parsing ==

  /**
   * parse(source)
   * parse source into JS object
   * similar to JSON.parse but buffer supported
   * @param {Uint8Array|ArrayBuffer|String} source enumedly typed source
   */
  function parse(source) {
    var s;
    if(typeof source==="string"||source instanceof String) {
      
    }
  };

  window.BSON = {
    gen,UTF8,genp,genArrs
  }

}()