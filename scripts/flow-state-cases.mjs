// School-sized programs: definite assignment, nullable locals/properties and simple closures.
const valid = (id, source, calls, output, classes = {}) => ({
  id,
  valid: true,
  files: {
    ...classes,
    "Main.kt":
      source +
      "\nfun main() { " +
      calls.map((c) => `println(${c})`).join("; ") +
      " }",
  },
  output: output + "\n",
});
const invalid = (id, source, classes = {}) => ({
  id,
  valid: false,
  files: { ...classes, "Main.kt": source + "\nfun main() {}" },
});
const length = (id, body, classes = {}) =>
  valid(
    id,
    `fun size(s: String?): Int { ${body} }`,
    ['size("abc")', "size(null)"],
    "3\n0",
    classes,
  );
export const flowStateCases = [
  valid(
    "val-if-else",
    'fun choose(b: Boolean): String { val x: String; if(b) x="a" else x="b"; return x }',
    ["choose(true)", "choose(false)"],
    "a\nb",
  ),
  valid(
    "val-nested-terminating-branch",
    'fun choose(b: Boolean,c: Boolean): String { val x: String; if(b) x="a" else { if(c) return "b" else throw IllegalStateException("c") }; return x }',
    ["choose(true,false)", "choose(false,true)"],
    "a\nb",
  ),
  valid(
    "val-nothing-property",
    'fun choose(b: Boolean): String { val x: String; if(b) x="a" else Abort.fail; return x }',
    ["choose(true)"],
    "a",
    { "Abort.kt": 'object Abort { val fail: Nothing get() = error("stop") }' },
  ),
  valid(
    "val-nested-when",
    'fun choose(b:Boolean):String { val x:String; when(b) { true->x="a";false->{ if(b) return "b" else throw IllegalStateException("c") } };return x }',
    ["choose(true)"],
    "a",
  ),
  valid(
    "val-try-returning-catch",
    'fun choose(b:Boolean):String { val x:String;try { if(!b) error("stop");x="a" } catch(e:Exception){ return "b" };return x }',
    ["choose(true)", "choose(false)"],
    "a\nb",
  ),
  valid(
    "val-try-finally-initialize",
    'fun choose():String { val x:String;try { println("try") } finally { x="a" };return x }',
    ["choose()"],
    "try\na",
  ),
  valid(
    "val-after-try-catch",
    'fun choose(b:Boolean):String { val x:String;try { if(b) error("stop") } catch(e:Exception) {};x="a";return x }',
    ["choose(true)", "choose(false)"],
    "a\na",
  ),
  invalid(
    "val-try-catch-missing",
    'fun choose():String { val x:String;try { x="a" } catch(e:Exception) {};return x }',
  ),
  invalid(
    "val-try-catch-read",
    'fun choose():String { val x:String;try { x="a" } catch(e:Exception) {println(x)};return x }',
  ),
  invalid(
    "val-try-catch-double",
    'fun choose():String { val x:String;try { x="a" } catch(e:Exception) {x="b"};return x }',
  ),
  invalid(
    "val-finally-early-read",
    'fun choose():String { val x:String;try { x="a" } finally {println(x)};return x }',
  ),
  invalid(
    "val-finally-double",
    'fun choose():String { val x:String;try {x="a"} finally{x="b"};return x }',
  ),
  valid(
    "val-do-once",
    'fun choose():String {val x:String;do{x="a"}while(false);return x}',
    ["choose()"],
    "a",
  ),
  valid(
    "val-while-break",
    'fun choose():String {val x:String;while(true){x="a";break};return x}',
    ["choose()"],
    "a",
  ),
  valid(
    "val-do-conditional-break",
    'fun choose():String {var i=0;val x:String;do{ i++;if(i==2){x="a";break} }while(true);return x}',
    ["choose()"],
    "a",
  ),
  valid(
    "val-loop-branches",
    'fun choose(b:Boolean):String {val x:String;while(true){if(b){x="a";break}else{x="b";break}};return x}',
    ["choose(true)", "choose(false)"],
    "a\nb",
  ),
  invalid(
    "val-loop-repeated",
    'fun choose():String {val x:String;for(i in 1..2){x="a"};return x}',
  ),
  invalid(
    "val-loop-continue-after-write",
    'fun choose(b:Boolean):String {val x:String;while(true){x="a";if(b)continue;break};return x}',
  ),
  invalid(
    "val-loop-skipped",
    'fun choose(b:Boolean):String {val x:String;while(b){x="a";break};return x}',
  ),
  invalid(
    "val-loop-break-before-write",
    'fun choose(b:Boolean):String {val x:String;while(true){if(b)break;x="a";break};return x}',
  ),
  valid(
    "val-in-loop-local",
    'fun choose():String {var s="";for(i in 1..2){val x:String;if(i==1)x="a" else x="b";s+=x};return s}',
    ["choose()"],
    "ab",
  ),
  invalid(
    "val-conditional-double",
    'fun choose(b:Boolean):String {val x:String;if(b)x="a";x="b";return x}',
  ),
  invalid(
    "val-incomplete-if",
    'fun choose(b:Boolean):String {val x:String;if(b)x="a";return x}',
  ),
  invalid(
    "val-local-function-write",
    'fun choose():String {val x:String;fun put(){x="a"};put();return x}',
  ),
  valid(
    "val-inline-run-initialize",
    'fun choose():String {val x:String;run{x="a"};return x}',
    ["choose()"],
    "a",
  ),
  valid(
    "val-inline-if-branches",
    'fun choose(b:Boolean):String {val x:String;run{if(b)x="a" else x="b"};return x}',
    ["choose(true)", "choose(false)"],
    "a\nb",
  ),
  invalid(
    "val-stored-lambda-initialize",
    'fun choose():String {val x:String;val put={x="a"};put();return x}',
  ),
  length("null-simple-guard", "if(s==null)return 0;return s.length"),
  length(
    "null-nested-guard",
    'if(s==null){if(true)return 0 else throw IllegalStateException("missing")};return s.length',
  ),
  length(
    "null-try-guard",
    "if(s==null){try{return 0}finally{}};return s.length",
  ),
  length(
    "null-nothing-property-guard",
    "if(s==null){try{Abort.fail}catch(e:Exception){return 0}};return s.length",
    { "Abort.kt": 'object Abort {val fail:Nothing get()=error("missing")}' },
  ),
  length("null-elvis-throw", "val text=s?:return 0;return text.length"),
  length(
    "null-elvis-nested-return",
    's?:if(true)return 0 else throw IllegalStateException("missing");return s.length',
  ),
  length("null-safe-equality", "if(s?.length==3)return s.length;return 0"),
  length(
    "null-boolean-alias",
    "val present=s!=null;if(present)return s.length;return 0",
  ),
  length("null-safe-let", "return s?.let{it.length}?:0"),
  length(
    "null-and-check",
    "if(s!=null && s.length==3)return s.length;return 0",
  ),
  length("null-or-guard", "if(s==null || s.length!=3)return 0;return s.length"),
  length("null-identity-check", "if(s===null)return 0;return s.length"),
  length(
    "null-assigned-both-branches",
    'var text=s;if(text==null)text="";return text.length',
  ),
  valid(
    "null-try-all-normal-paths",
    'fun size(b:Boolean):Int {var s:String?=null;try{if(b)throw IllegalStateException("stop");s="abc"}catch(e:Exception){s="a"};return s.length}',
    ["size(true)", "size(false)"],
    "1\n3",
  ),
  invalid(
    "null-try-missing-catch-path",
    'fun size(b:Boolean):Int {var s:String?=null;try{if(b)throw IllegalStateException("stop");s="abc"}catch(e:Exception){};return s.length}',
  ),
  invalid(
    "null-finally-invalidates",
    'fun size():Int {var s:String?="abc";try{}finally{s=null};return s.length}',
  ),
  valid(
    "null-finally-initialize",
    'fun size():Int {var s:String?=null;try{}finally{s="abc"};return s.length}',
    ["size()"],
    "3",
  ),
  invalid(
    "null-loop-may-skip",
    'fun size(b:Boolean):Int {var s:String?=null;while(b){s="abc";break};return s.length}',
  ),
  invalid(
    "null-loop-next-iteration",
    'fun size():Int {var s:String?="abc";repeat(2){println(s.length);s=null};return 0}',
  ),
  valid(
    "lambda-val-capture",
    "fun size(s:String?):Int {if(s==null)return 0;val f={s.length};return f()}",
    ['size("abc")', "size(null)"],
    "3\n0",
  ),
  valid(
    "lambda-unmodified-var-capture",
    "fun size(s:String?):Int {var text=s;if(text==null)return 0;val f={text.length};return f()}",
    ['size("abc")', "size(null)"],
    "3\n0",
  ),
  invalid(
    "lambda-later-var-write",
    'fun size():Int {var s:String?="abc";val f={s.length};s=null;return f()}',
  ),
  invalid(
    "lambda-captured-writer",
    'fun size():Int {var s:String?="abc";val clear={s=null};clear();return s.length}',
  ),
  valid(
    "lambda-local-var",
    'fun size():Int {return listOf("abc").map{var s:String?=it;if(s==null)0 else s.length}.first()}',
    ["size()"],
    "3",
  ),
  valid(
    "property-stable-val",
    "fun size(b:Box):Int {if(b.text==null)return 0;return b.text.length}",
    ['size(Box("abc"))', "size(Box(null))"],
    "3\n0",
    { "Box.kt": "class Box(val text:String?)" },
  ),
  invalid(
    "property-mutable-var",
    "fun size(b:Box):Int {if(b.text==null)return 0;return b.text.length}",
    { "Box.kt": "class Box(var text:String?)" },
  ),
  invalid(
    "property-custom-getter",
    "fun size(b:Box):Int {if(b.text==null)return 0;return b.text.length}",
    { "Box.kt": 'class Box {val text:String? get()="abc"}' },
  ),
  invalid("property-implicit-mutable", "", {
    "Box.kt":
      "class Box(var text:String?){fun size():Int {if(text==null)return 0;return text.length}}",
  }),
  invalid("property-implicit-getter", "", {
    "Box.kt":
      'class Box {val text:String? get()="abc";fun size():Int {if(text==null)return 0;return text.length}}',
  }),
  valid(
    "property-this-stable",
    "",
    ['Box("abc").size()', "Box(null).size()"],
    "3\n0",
    {
      "Box.kt":
        "class Box(val text:String?){fun size():Int {if(this.text==null)return 0;return this.text.length}}",
    },
  ),
  valid(
    "property-chain-stable",
    "fun size(b:Box):Int {if(b.inner.text==null)return 0;return b.inner.text.length}",
    ['size(Box(Inner("abc")))', "size(Box(Inner(null)))"],
    "3\n0",
    {
      "Inner.kt": "class Inner(val text:String?)",
      "Box.kt": "class Box(val inner:Inner)",
    },
  ),
  invalid(
    "property-chain-mutable-root",
    "fun size(b:Box):Int {if(b.inner.text==null)return 0;return b.inner.text.length}",
    {
      "Inner.kt": "class Inner(val text:String?)",
      "Box.kt": "class Box(var inner:Inner)",
    },
  ),
  valid(
    "nullable-boolean-equality",
    'fun size(b:Boolean?):String {if(b==true)return b.toString();return "no"}',
    ["size(true)", "size(null)"],
    "true\nno",
  ),
  invalid(
    "nullable-boolean-direct",
    'fun size(b:Boolean?):String {if(b)return "yes";return "no"}',
  ),
  valid(
    "type-simple-lambda",
    "fun size(a:Any):Int {var x=a;if(x is String){val f={x.length};return f()};return 0}",
    ['size("abc")', "size(1)"],
    "3\n0",
  ),
  valid(
    "val-run-inside-stored-lambda",
    'fun choose():String {val f={val x:String;run{x="a"};x};return f()}',
    ["choose()"],
    "a",
  ),
  valid(
    "val-run-labeled-returns",
    'fun choose(b:Boolean):String {val x:String;run{if(b){x="a";return@run}else{x="b";return@run}};return x}',
    ["choose(true)", "choose(false)"],
    "a\nb",
  ),
  invalid(
    "val-safe-let-may-skip",
    'fun choose(s:String?):String {val x:String;s?.let{x="a"};return x}',
  ),
  valid(
    "val-finally-after-loop-break",
    'fun choose():String{val x:String;while(true){try{break}finally{x="a"}};return x}',
    ["choose()"],
    "a",
  ),
  invalid(
    "val-finally-break-skips-write",
    'fun choose():String{val x:String;while(true){try{x="a"}finally{break}};return x}',
  ),
  invalid(
    "null-run-initialize",
    'fun size():Int{var s:String?=null;run{s="abc"};return s.length}',
  ),
  invalid(
    "null-boolean-alias-invalidated",
    'fun size():Int{var s:String?="abc";val present=s!=null;s=null;if(present)return s.length;return 0}',
  ),
  invalid(
    "null-while-back-edge",
    'fun size():Int{var s:String?="abc";var i=0;while(i<2){println(s.length);s=null;i++};return 0}',
  ),
  invalid(
    "null-do-once-read-before-write",
    'fun size():Int{var s:String?="abc";var n=0;do{n=s.length;s=null}while(false);return n}',
  ),
  valid(
    "null-lambda-shadowed-write",
    'fun size(s:String?):Int{var text=s;if(text==null)return 0;val f={var text:String?=null;text="x";text.length};return text.length+f()}',
    ['size("abc")', "size(null)"],
    "4\n0",
  ),
  valid(
    "null-unmodified-var-map",
    "fun size(s:String?):Int{var text=s;if(text==null)return 0;return listOf(1,2).map{text.length}.sum()}",
    ['size("abc")', "size(null)"],
    "6\n0",
  ),
  invalid(
    "property-root-reassigned",
    'fun size():Int{var b=Box("abc");if(b.text==null)return 0;b=Box(null);return b.text.length}',
    { "Box.kt": "class Box(val text:String?)" },
  ),
  valid(
    "nullable-boolean-refined",
    'fun size(b:Boolean?):String{if(b==true){if(b)return "yes"};return "no"}',
    ["size(true)", "size(null)"],
    "yes\nno",
  ),
  valid(
    "member-val-if-else",
    "",
    ["Box(true).text", "Box(false).text"],
    "a\nb",
    {
      "Box.kt":
        'class Box(b:Boolean){val text:String;init{if(b)text="a" else text="b"}}',
    },
  ),
  valid("member-val-when", "", ["Box(true).text", "Box(false).text"], "a\nb", {
    "Box.kt":
      'class Box(b:Boolean){val text:String;init{when(b){true->text="a";false->text="b"}}}',
  }),
  invalid("member-val-missing-branch", "", {
    "Box.kt": 'class Box(b:Boolean){val text:String;init{if(b)text="a"}}',
  }),
  invalid("member-val-double", "", {
    "Box.kt": 'class Box{val text:String;init{text="a";text="b"}}',
  }),
  invalid("member-val-method-write", "", {
    "Box.kt": 'class Box{val text:String;fun put(){text="a"}}',
  }),
  valid("member-val-throwing-branch", "", ["Box(true).text"], "a", {
    "Box.kt":
      'class Box(b:Boolean){val text:String;init{if(b)text="a" else throw IllegalStateException("stop")}}',
  }),
  valid(
    "null-loop-break-assigned",
    'fun size():Int{var s:String?=null;while(true){s="abc";break};return s.length}',
    ["size()"],
    "3",
  ),
  invalid(
    "null-loop-break-unassigned",
    'fun size(b:Boolean):Int{var s:String?=null;while(true){if(b)break;s="abc";break};return s.length}',
  ),
  invalid(
    "null-finally-after-break-invalidates",
    'fun size():Int{var s:String?="abc";while(true){try{break}finally{s=null}};return s.length}',
  ),
  valid(
    "val-run-finally-return",
    'fun choose():String{val x:String;run{try{return@run}finally{x="a"}};return x}',
    ["choose()"],
    "a",
  ),
  invalid(
    "val-run-optional-assign",
    'fun choose(b:Boolean):String{val x:String;run{if(b)x="a"};return x}',
  ),
  invalid(
    "val-for-break-may-skip",
    'fun choose():String{val x:String;for(i in 1..1){x="a";break};return x}',
  ),
  valid(
    "val-try-expression",
    'fun choose(b:Boolean):String{val x=try{if(b)error("stop");"a"}catch(e:Exception){"b"};return x}',
    ["choose(true)", "choose(false)"],
    "b\na",
  ),
  invalid(
    "null-open-property",
    "fun size(b:Box):Int{if(b.text==null)return 0;return b.text.length}",
    { "Box.kt": "open class Box(open val text:String?)" },
  ),
  valid(
    "member-val-explicit-this",
    "",
    ["Box(true).text", "Box(false).text"],
    "a\nb",
    {
      "Box.kt":
        'class Box(b:Boolean){val text:String;init{if(b)this.text="a" else this.text="b"}}',
    },
  ),
  valid(
    "member-var-if-else",
    "",
    ["Box(true).text", "Box(false).text"],
    "a\nb",
    {
      "Box.kt":
        'class Box(b:Boolean){var text:String;init{if(b)text="a" else text="b"}}',
    },
  ),
  invalid("member-var-missing-branch", "", {
    "Box.kt": 'class Box(b:Boolean){var text:String;init{if(b)text="a"}}',
  }),
  invalid("member-val-read-before-initialize", "", {
    "Box.kt": 'class Box{val text:String;init{println(this.text);text="a"}}',
  }),
  invalid("member-val-inline-run", "", {
    "Box.kt": 'class Box{val text:String;init{run{text="a"}}}',
  }),
  valid("member-val-method-reader", "", ["Box().text"], "a", {
    "Box.kt":
      'class Box{val text:String;init{text=get()};fun get():String{if(false)return text;return "a"}}',
  }),
  valid("member-val-multiple-init", "", ["Box().text"], "first\na", {
    "Box.kt":
      'class Box{val text:String;init{println("first")};init{text="a"}}',
  }),
  valid(
    "var-if-else",
    'fun choose(b:Boolean):String{var x:String;if(b)x="a" else x="b";return x}',
    ["choose(true)", "choose(false)"],
    "a\nb",
  ),
  invalid(
    "var-if-missing-branch",
    'fun choose(b:Boolean):String{var x:String;if(b)x="a";return x}',
  ),
  invalid(
    "var-try-missing-catch-path",
    'fun choose():String{var x:String;try{x="a"}catch(e:Exception){};return x}',
  ),
  valid(
    "var-do-once",
    'fun choose():String{var x:String;do{x="a"}while(false);return x}',
    ["choose()"],
    "a",
  ),
  invalid(
    "var-while-may-skip",
    'fun choose(b:Boolean):String{var x:String;while(b){x="a";break};return x}',
  ),
  invalid(
    "var-stored-lambda-may-not-initialize",
    'fun choose():String{var x:String;val f={x="a"};f();return x}',
  ),
  valid(
    "var-run-definite-initialize",
    'fun choose():String{var x:String;run{x="a"};return x}',
    ["choose()"],
    "a",
  ),
  invalid(
    "val-constant-true-initialize",
    'fun choose():String{val x:String;if(true)x="a";return x}',
  ),
  invalid(
    "var-constant-true-initialize",
    'fun choose():String{var x:String;if(true)x="a";return x}',
  ),
  invalid(
    "var-local-function-may-not-initialize",
    'fun choose():String{var x:String;fun put(){x="a"};put();return x}',
  ),
  valid(
    "var-local-function-after-initialize",
    'fun choose():String{var x:String;fun put(){x="b"};x="a";put();return x}',
    ["choose()"],
    "b",
  ),
  invalid(
    "property-root-lambda-reassigned",
    'fun size():Int{var b=Box("abc");if(b.text==null)return 0;val f={b.text.length};b=Box(null);return f()}',
    { "Box.kt": "class Box(val text:String?)" },
  ),
  valid(
    "property-root-lambda-unmodified",
    'fun size():Int{var b=Box("abc");if(b.text==null)return 0;val f={b.text.length};return f()}',
    ["size()"],
    "3",
    { "Box.kt": "class Box(val text:String?)" },
  ),
  invalid(
    "property-global-mutable-root",
    'var b=Box("abc");fun size():Int{if(b.text==null)return 0;return b.text.length}',
    { "Box.kt": "class Box(val text:String?)" },
  ),
  invalid(
    "type-conditional-assignment-invalidates",
    'fun size(b:Boolean):Int{var s:Any="abc";if(s is String){if(b)s=1;return s.length};return 0}',
  ),
  valid(
    "type-alternative-retains-original-fact",
    'fun size(b:Boolean):Int{var s:Any="abc";if(s is String){if(b){s=1}else{return s.length};return 0};return 0}',
    ["size(true)", "size(false)"],
    "0\n3",
  ),
  valid(
    "null-when-all-paths-assigned",
    'fun size(b:Boolean):Int{var s:String?=null;when(b){true->s="a";false->s="abc"};return s.length}',
    ["size(true)", "size(false)"],
    "1\n3",
  ),
  invalid(
    "null-when-missing-path",
    'fun size(b:Boolean):Int{var s:String?=null;when{b->s="a"};return s.length}',
  ),
  valid(
    "val-run-suspends-around-initialize",
    'fun choose():String{val x:String;run{Thread.sleep(1);x="a";Thread.sleep(1)};return x}',
    ["choose()"],
    "a",
  ),
  valid(
    "core-scope-contracts",
    'fun choose():String{val a:String;val b:String;val c:String;val d:String;val e:String;run{a="r"};"l".let{b=it};with("w"){c=this};"a".also{d=it};"p".apply{e=this};return a+b+c+d+e}',
    ["choose()"],
    "rlwap",
  ),
  invalid(
    "global-var-needs-initializer",
    'var x:String;fun choose():String{x="a";return x}',
  ),
  invalid("global-val-needs-initializer", "val x:String"),
  valid(
    "global-null-initializer",
    "var x:String?=null;fun choose():String?=x",
    ["choose()"],
    "null",
  ),
  valid(
    "global-lateinit",
    'lateinit var x:String;fun choose():String{x="a";return x}',
    ["choose()"],
    "a",
  ),
];
