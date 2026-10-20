// Split project fixtures: class/interface files remain separate from the caller.
const cases = [];
const add = (id, files, main, output, valid = true) =>
  cases.push({
    id,
    files: { ...files, "Main.kt": `fun main() {\n${main}\n}` },
    valid,
    output,
  });
const first = {
  "First.kt": "interface First { fun one():String }",
  "Second.kt": "interface Second { fun two():String }",
  "Both.kt":
    'class Both:First,Second { override fun one()="one"; override fun two()="two" }',
};
add(
  "unrelated-interfaces",
  {
    ...first,
    "Functions.kt":
      "fun probe(item:First) { if(item is Second) { println(item.one()); println(item.two()); val first:First=item; val second:Second=item; println(first.one()+second.two()) } }",
  },
  "probe(Both())",
  "one\ntwo\nonetwo\n",
);
add(
  "nullable-interface",
  {
    ...first,
    "Functions.kt":
      "fun probe(item:First?) { if(item is Second) { println(item.one()+item.two()) }; println(item?.one()) }",
  },
  "probe(Both()); probe(null)",
  "onetwo\none\nnull\n",
);
add(
  "class-and-interface",
  {
    "Base.kt": "open class Base(val name:String)",
    "Named.kt": "interface Named { fun label():String }",
    "Child.kt": 'class Child:Base("Ada"),Named { override fun label()=name }',
    "Functions.kt":
      "fun probe(item:Base) { if(item is Named) { println(item.name+item.label()) } }",
  },
  "probe(Child())",
  "AdaAda\n",
);
add(
  "three-interfaces",
  {
    ...first,
    "Third.kt": "interface Third { fun three():String }",
    "All.kt":
      'class All:First,Second,Third { override fun one()="1"; override fun two()="2"; override fun three()="3" }',
    "Functions.kt":
      "fun probe(x:First) { if(x is Second && x is Third) { println(x.one()+x.two()+x.three()) } }",
  },
  "probe(All())",
  "123\n",
);
add(
  "generic-interface",
  {
    "Source.kt": "interface Source<T> { fun get():T }",
    "Named.kt": "interface Named { fun label():String }",
    "Text.kt":
      'class Text:Source<String>,Named { override fun get()="text"; override fun label()="name" }',
    "Functions.kt":
      "fun probe(x:Source<String>) { if(x is Named) { val text:String=x.get(); println(text+x.label()) } }",
  },
  "probe(Text())",
  "textname\n",
);
add(
  "captured-intersection",
  {
    ...first,
    "Functions.kt":
      "fun probe(item:First) { if(item is Second) { val read={ item.one()+item.two() }; println(read()) } }",
  },
  "probe(Both())",
  "onetwo\n",
);
add(
  "inferred-intersection-local",
  {
    ...first,
    "Functions.kt":
      "fun probe(item:First) { if(item is Second) { val copy=item; println(copy.one()+copy.two()) } }",
  },
  "probe(Both())",
  "onetwo\n",
);
add(
  "intersection-when",
  {
    ...first,
    "Functions.kt":
      'fun probe(item:First) { when(item) { is Second -> println(item.one()+item.two()); else -> println("other") } }',
  },
  "probe(Both())",
  "onetwo\n",
);
add(
  "intersection-invalidated",
  { ...first, "Only.kt": 'class Only:First { override fun one()="only" }' },
  "var item:First=Both(); if(item is Second) { item=Only(); println(item.two()) }",
  null,
  false,
);
add(
  "intersection-not-after-if",
  {
    ...first,
    "Functions.kt":
      "fun probe(item:First) { if(item is Second) println(item.two()); println(item.two()) }",
  },
  "probe(Both())",
  null,
  false,
);
add(
  "intersection-overloads",
  {
    "First.kt": "interface First { fun format(n:Int):String }",
    "Second.kt": "interface Second { fun format(s:String):String }",
    "Both.kt":
      'class Both:First,Second { override fun format(n:Int)="i$n"; override fun format(s:String)="s$s" }',
    "Functions.kt":
      'fun probe(x:First) { if(x is Second) { println(x.format(1)); println(x.format("x")) } }',
  },
  "probe(Both())",
  "i1\nsx\n",
);
const defaults = {
  "A.kt": 'interface A { fun text():String="A" }',
  "B.kt": 'interface B { fun text():String="B" }',
};
add(
  "conflicting-defaults",
  { ...defaults, "C.kt": "class C:A,B" },
  "println(C().text())",
  null,
  false,
);
add(
  "abstract-class-conflict",
  { ...defaults, "C.kt": "abstract class C:A,B" },
  'println("unused")',
  null,
  false,
);
add(
  "interface-conflict",
  { ...defaults, "C.kt": "interface C:A,B" },
  'println("unused")',
  null,
  false,
);
add(
  "abstract-and-default",
  {
    "A.kt": "interface A { fun text():String }",
    "B.kt": defaults["B.kt"],
    "C.kt": "class C:A,B",
  },
  "println(C().text())",
  null,
  false,
);
add(
  "own-conflict-resolution",
  { ...defaults, "C.kt": 'class C:A,B { override fun text()="C" }' },
  "println(C().text())",
  "C\n",
);
add(
  "abstract-conflict-resolution",
  {
    ...defaults,
    "C.kt": "abstract class C:A,B { abstract override fun text():String }",
    "D.kt": 'class D:C() { override fun text()="D" }',
  },
  "println(D().text())",
  "D\n",
);
add(
  "common-diamond",
  {
    "A.kt": defaults["A.kt"],
    "B.kt": "interface B:A",
    "D.kt": "interface D:A",
    "C.kt": "class C:B,D",
  },
  "println(C().text())",
  "A\n",
);
for (const order of ["A,B", "B,A"])
  add(
    "specific-" + order.replace(",", "-"),
    {
      "A.kt": defaults["A.kt"],
      "B.kt": 'interface B:A { override fun text()="B" }',
      "C.kt": `class C:${order}`,
    },
    "println(C().text())",
    "B\n",
  );
add(
  "reabstracted-interface",
  {
    "A.kt": defaults["A.kt"],
    "B.kt": "interface B:A { override fun text():String }",
    "C.kt": "class C:B",
  },
  'println("unused")',
  null,
  false,
);
add(
  "class-and-default",
  {
    "A.kt": 'open class A { open fun text()="A" }',
    "B.kt": defaults["B.kt"],
    "C.kt": "class C:A(),B",
  },
  'println("unused")',
  null,
  false,
);
add(
  "class-implements-abstract",
  {
    "A.kt": 'open class A { open fun text()="A" }',
    "B.kt": "interface B { fun text():String }",
    "C.kt": "class C:A(),B",
  },
  "println(C().text())",
  "A\n",
);
add(
  "abstract-base-and-default",
  {
    "A.kt": "abstract class A { abstract fun text():String }",
    "B.kt": defaults["B.kt"],
    "C.kt": "class C:A(),B",
  },
  'println("unused")',
  null,
  false,
);
add(
  "generic-default-override",
  {
    "A.kt": "interface A<T> { fun echo(x:T):T=x }",
    "B.kt": 'interface B { fun echo(x:String):String="b$x" }',
    "C.kt": 'class C:A<String>,B { override fun echo(x:String)="c$x" }',
  },
  'println(C().echo("x"))',
  "cx\n",
);
add(
  "super-A",
  {
    ...defaults,
    "C.kt": "class C:A,B { override fun text()=super<A>.text() }",
  },
  "println(C().text())",
  "A\n",
);
add(
  "super-both",
  {
    ...defaults,
    "C.kt":
      "class C:A,B { override fun text()=super<A>.text()+super<B>.text() }",
  },
  "println(C().text())",
  "AB\n",
);
add(
  "super-preserves-this",
  {
    "A.kt": "interface A { fun label():String; fun text():String=label() }",
    "C.kt":
      'class C:A { override fun label()="C"; override fun text()="["+super<A>.text()+"]" }',
  },
  "println(C().text())",
  "[C]\n",
);
add(
  "super-generic",
  {
    "A.kt": "interface A<T> { fun echo(x:T):T=x }",
    "C.kt":
      "class C:A<String> { override fun echo(x:String)=super<A>.echo(x) }",
  },
  'println(C().echo("hello"))',
  "hello\n",
);
add(
  "super-in-interface",
  {
    "A.kt": defaults["A.kt"],
    "B.kt": 'interface B:A { override fun text()=super<A>.text()+"B" }',
    "C.kt": "class C:B",
  },
  "println(C().text())",
  "AB\n",
);
add(
  "super-class-qualified",
  {
    "A.kt": 'open class A { open fun text()="A" }',
    "C.kt": 'class C:A() { override fun text()=super<A>.text()+"C" }',
  },
  "println(C().text())",
  "AC\n",
);
add(
  "super-indirect",
  {
    "A.kt": defaults["A.kt"],
    "B.kt": "interface B:A",
    "C.kt": "class C:B { override fun text()=super<A>.text() }",
  },
  'println("unused")',
  null,
  false,
);
add(
  "super-abstract",
  {
    "A.kt": "interface A { fun text():String }",
    "C.kt": "class C:A { override fun text()=super<A>.text() }",
  },
  'println("unused")',
  null,
  false,
);
add(
  "super-unrelated",
  {
    "A.kt": defaults["A.kt"],
    "B.kt": defaults["B.kt"],
    "C.kt": "class C:A { override fun text()=super<B>.text() }",
  },
  'println("unused")',
  null,
  false,
);
add("super-outside-class", defaults, "println(super<A>.text())", null, false);
add(
  "super-suspension",
  {
    "A.kt": 'interface A { fun text():String { Thread.sleep(1); return "A" } }',
    "C.kt": 'class C:A { override fun text()=super<A>.text()+"C" }',
  },
  "println(C().text())",
  "AC\n",
);
add(
  "super-in-lambda",
  {
    "A.kt": defaults["A.kt"],
    "C.kt":
      'class C:A { override fun text():String { val read={ super<A>.text() }; return read()+"C" } }',
  },
  "println(C().text())",
  "AC\n",
);
add(
  "super-escaping-lambda",
  {
    "A.kt": defaults["A.kt"],
    "C.kt": "class C:A { fun reader():()->String = { super<A>.text() } }",
  },
  "val read=C().reader(); println(read())",
  "A\n",
);
add(
  "intersection-properties",
  {
    "First.kt": "interface First { val name:String }",
    "Second.kt": "interface Second<T> { val value:T }",
    "Both.kt":
      'class Both:First,Second<Int> { override val name="value"; override val value=42 }',
    "Functions.kt":
      "fun probe(x:Second<Int>) { if(x is First) { println(x.name); val n:Int=x.value; println(n) } }",
  },
  "probe(Both())",
  "value\n42\n",
);
add(
  "super-not-value",
  {
    "A.kt": defaults["A.kt"],
    "C.kt": "class C:A { fun bad() { val x=super<A> } }",
  },
  'println("unused")',
  null,
  false,
);
add(
  "super-nullable-qualifier",
  {
    "A.kt": defaults["A.kt"],
    "C.kt": "class C:A { override fun text()=super<A?>.text() }",
  },
  'println("unused")',
  null,
  false,
);
add(
  "super-type-arguments",
  {
    "A.kt": "interface A<T> { fun echo(x:T):T=x }",
    "C.kt":
      "class C:A<String> { override fun echo(x:String)=super<A<String>>.echo(x) }",
  },
  'println(C().echo("ok"))',
  "ok\n",
);
add(
  "super-wrong-type-arguments",
  {
    "A.kt": "interface A<T> { fun echo(x:T):T=x }",
    "C.kt":
      "class C:A<String> { override fun echo(x:String)=super<A<Int>>.echo(x) }",
  },
  'println("unused")',
  null,
  false,
);
add(
  "intersection-guard-order",
  {
    ...first,
    "Third.kt": "interface Third { fun three():String }",
    "All.kt":
      'class All:First,Second,Third { override fun one()="1"; override fun two()="2"; override fun three()="3" }',
    "Functions.kt":
      "fun probe(x:First) { if ((x is Second && x is Third) || (x is Third && x is Second)) { println(x.one()+x.two()+x.three()) } }",
  },
  "probe(All())",
  "123\n",
);
add(
  "private-abstract-member",
  { "C.kt": "class C { private abstract fun text():String }" },
  'println("unused")',
  null,
  false,
);
add(
  "private-base-interface-default",
  {
    "Base.kt":
      'open class Base { private fun text()="private"; fun baseCall()=text() }',
    "I.kt": 'interface I { fun text()="interface" }',
    "C.kt": "class C:Base(),I { fun ownCall()=text() }",
  },
  "val c=C(); println(c.text()); println(c.baseCall()); println(c.ownCall())",
  "interface\nprivate\ninterface\n",
);
add(
  "private-base-child-method",
  {
    "Base.kt":
      'open class Base { private fun text()="private"; fun baseCall()=text() }',
    "C.kt": 'class C:Base() { fun text()="child" }',
  },
  "val c=C(); println(c.text()); println(c.baseCall())",
  "child\nprivate\n",
);
export const interfaceCases = cases;
