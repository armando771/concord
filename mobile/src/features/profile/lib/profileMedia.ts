// URLs do avatar e do banner do perfil. A regra do GIF animado ("a_<uuid>", "/static") vive em
// shared/lib/mediaUrl.ts porque o Avatar compartilhado também a usa.
export { isAnimatedMedia, mediaSrc as profileMediaSrc } from '../../../shared/lib/mediaUrl'
