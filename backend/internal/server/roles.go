package server

import "errors"

var ErrInvalidPrimaryChannel = errors.New("o canal principal precisa ser um canal de texto deste servidor")
