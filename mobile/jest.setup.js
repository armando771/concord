// Os ícones do @expo/vector-icons carregam fonte/asset que o Jest não registra.
jest.mock('@expo/vector-icons', () => ({ Ionicons: Object.assign(() => null, { glyphMap: {} }) }))
