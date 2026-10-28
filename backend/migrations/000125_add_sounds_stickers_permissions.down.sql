UPDATE roles SET permissions = permissions & ~805306368;
UPDATE channel_overwrites SET allow = allow & ~805306368, deny = deny & ~805306368;
