# Generics and inline calls

Developer reference; [user-facing limits](kotlin-support.md#calls-inference-and-smart-casts).

## Classes and variance

Generic classes/member values and identity survive repeated `session.load`
and codepad evaluation. List/Collection/Iterable are covariant;
MutableList/MutableCollection are invariant.

## Reified types and closures

`inline fun <reified T>` exposes the concrete call type to `is T`, `!is T`
and `as T`. Nested/returned lambdas capture resolved types together with their
lexical variables; repeated factories must not share type substitutions.
Inner type parameters shadow outer names.

Reject non-reified runtime type checks, forwarding non-reified types to reified
parameters (including inferred forwarding), reified class parameters and
reified Nothing. Runtime checks inspect classifier/nullability rather than
collection elements: reified `List<String>` checks can accept a list of numbers
under erasure. Direct `any is List<String>` is rejected when element types
cannot be checked; `List<*>` is allowed.

## Inline control flow

The interpreter models semantics without textual code expansion:

- Ordinary inline lambda parameters allow non-local return to the lexical
  enclosing function, including through nested inline calls/forwarding.
- `noinline` permits storage, return and forwarding as a value, but no non-local
  return from its lambda.
- `crossinline` permits invocation inside a returned wrapper lambda, but no
  non-local return or escaping as an ordinary function value.
- Local `return@function` and explicit labels work. Non-local return bypasses
  catch but executes finally.
- Return targets belong to individual activations. Recursion, closures and
  suspension must not mix them up.

The analyzer validates forwarding, returns and modifier combinations.
`StdlibInlineMetadata` supplies missing metadata for explicitly listed older
binary-stdlib functions. New host definitions declare modifiers directly.
There is no optimization by inlining, inline-property/reflection support or
cross-module PublishedApi validation. Non-local break/continue across lambdas
remain unsupported.

## Host function contract

`FunctionCallNode.typeArguments` propagates explicit/inferred types to
`CallableNode.execute(..., typeArguments)`. Host
`CustomFunctionDefinition.typeParameters` resolve to DataTypes in the final
callback argument. `TypeParameter.isReified` and `FunctionModifier.inline`
represent reified host functions; `extraTypeParameters` describes receiver-only
parameters.

`GenericCollectionsModule` implements:

```kotlin
inline fun <reified T> Iterable<S>.filterIsInstance(): List<T>
```

S is resolved from the receiver; only T is specified at the call. The native
implementation shares `DataType.acceptsRuntimeType` with type checks/casts and
preserves subclasses, nullable targets, order and identity.

## Verification

`npm run test:generics` runs `smoke-generics.mjs` and
`smoke-generics-boundaries.mjs` against the built bundle. Tests cover valid
results, rejection phases, captures, recursion, labels, modifiers and suspension.
`tests/gui/generics.spec.ts` covers the real browser/worker path.
Actual results belong in [regression-checklist.md](regression-checklist.md).
