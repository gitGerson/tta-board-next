ALTER TABLE "boards" ADD COLUMN "route_key" VARCHAR(16);

UPDATE "boards"
SET "route_key" = translate(
    encode(decode(substr(md5("id"::text), 1, 24), 'hex'), 'base64'),
    '+/',
    '-_'
);

ALTER TABLE "boards" ALTER COLUMN "route_key" SET NOT NULL;

CREATE UNIQUE INDEX "boards_route_key_key" ON "boards"("route_key");
