package com.sunnychung.lib.multiplatform.kotlite.error

import com.sunnychung.lib.multiplatform.kotlite.model.Token

class UnexpectedTokenException(val token: Token, val missingOperand: Boolean = false) : ParseException("Unexpected token $token at line ${token.position.lineNum} col ${token.position.col}")
