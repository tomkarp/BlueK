(function (factory) {
  if (typeof define === 'function' && define.amd)
    define(['exports', './kotlin-kotlin-stdlib.js'], factory);
  else if (typeof exports === 'object')
    factory(module.exports, require('./kotlin-kotlin-stdlib.js'));
  else {
    if (typeof globalThis['kotlin-kotlin-stdlib'] === 'undefined') {
      throw new Error("Error loading module 'bluek-kotlin-js-spike'. Its dependency 'kotlin-kotlin-stdlib' was not found. Please, check whether 'kotlin-kotlin-stdlib' is loaded prior to 'bluek-kotlin-js-spike'.");
    }
    globalThis['bluek-kotlin-js-spike'] = factory(typeof globalThis['bluek-kotlin-js-spike'] === 'undefined' ? {} : globalThis['bluek-kotlin-js-spike'], globalThis['kotlin-kotlin-stdlib']);
  }
}(function (_, kotlin_kotlin) {
  'use strict';
  //region block: imports
  var LinkedHashMap_init_$Create$ = kotlin_kotlin.$_$.b;
  var Unit_instance = kotlin_kotlin.$_$.d;
  var protoOf = kotlin_kotlin.$_$.i;
  var toString = kotlin_kotlin.$_$.j;
  var IllegalStateException_init_$Create$ = kotlin_kotlin.$_$.c;
  var initMetadataForClass = kotlin_kotlin.$_$.h;
  var VOID = kotlin_kotlin.$_$.a;
  var listOf = kotlin_kotlin.$_$.f;
  var joinToString = kotlin_kotlin.$_$.e;
  var println = kotlin_kotlin.$_$.g;
  //endregion
  //region block: pre-declaration
  initMetadataForClass(IdentityRuntime, 'IdentityRuntime', IdentityRuntime);
  initMetadataForClass(Person, 'Person');
  initMetadataForClass(Student, 'Student', VOID, Person);
  initMetadataForClass(Box, 'Box');
  //endregion
  function IdentityRuntime() {
    var tmp = this;
    // Inline function 'kotlin.collections.mutableMapOf' call
    tmp.f4_1 = LinkedHashMap_init_$Create$();
  }
  protoOf(IdentityRuntime).createPerson = function (id, name) {
    // Inline function 'kotlin.also' call
    var this_0 = new Student(name);
    // Inline function 'kotlin.collections.set' call
    this.f4_1.j1(id, this_0);
    return this_0;
  };
  protoOf(IdentityRuntime).rename = function (id, name) {
    var tmp = this.f4_1.m(id);
    var tmp0_elvis_lhs = tmp instanceof Person ? tmp : null;
    var tmp_0;
    if (tmp0_elvis_lhs == null) {
      var message = 'unknown object: ' + id;
      throw IllegalStateException_init_$Create$(toString(message));
    } else {
      tmp_0 = tmp0_elvis_lhs;
    }
    var person = tmp_0;
    person.g4_1 = name;
    return person.h4();
  };
  protoOf(IdentityRuntime).sameObject = function (id, other) {
    return this.f4_1.m(id) === other;
  };
  protoOf(IdentityRuntime).isStudent = function (id) {
    var tmp = this.f4_1.m(id);
    return tmp instanceof Student;
  };
  protoOf(IdentityRuntime).stringBox = function (value) {
    return new Box(value);
  };
  function Person(name) {
    this.g4_1 = name;
  }
  protoOf(Person).h4 = function () {
    return 'Hello, ' + this.g4_1 + '!';
  };
  function Student(name) {
    Person.call(this, name);
  }
  protoOf(Student).h4 = function () {
    return 'Student: ' + protoOf(Person).h4.call(this);
  };
  function Box(value) {
    this.j4_1 = value;
  }
  function createProbe() {
    return new IdentityRuntime();
  }
  function main() {
    var runtime = new IdentityRuntime();
    var person = runtime.createPerson('p', 'Ada');
    var result = joinToString(listOf([runtime.rename('p', 'Grace'), 'same=' + runtime.sameObject('p', person), 'student=' + runtime.isStudent('p'), 'box=' + runtime.stringBox('ok').j4_1]), ';');
    println(result);
  }
  function mainWrapper() {
    main();
  }
  //region block: exports
  function $jsExportAll$(_) {
    var $de = _.de || (_.de = {});
    var $de$tomkarp = $de.tomkarp || ($de.tomkarp = {});
    var $de$tomkarp$bluek = $de$tomkarp.bluek || ($de$tomkarp.bluek = {});
    var $de$tomkarp$bluek$spike = $de$tomkarp$bluek.spike || ($de$tomkarp$bluek.spike = {});
    $de$tomkarp$bluek$spike.IdentityRuntime = IdentityRuntime;
    var $de = _.de || (_.de = {});
    var $de$tomkarp = $de.tomkarp || ($de.tomkarp = {});
    var $de$tomkarp$bluek = $de$tomkarp.bluek || ($de$tomkarp.bluek = {});
    var $de$tomkarp$bluek$spike = $de$tomkarp$bluek.spike || ($de$tomkarp$bluek.spike = {});
    $de$tomkarp$bluek$spike.createProbe = createProbe;
  }
  $jsExportAll$(_);
  //endregion
  mainWrapper();
  return _;
}));

//# sourceMappingURL=bluek-kotlin-js-spike.js.map
