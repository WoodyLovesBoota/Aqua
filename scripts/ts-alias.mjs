// node --import ./scripts/ts-alias.mjs: "@/..." 별칭과 확장자 없는 상대 import 를 src/*.ts 로 풀어준다 (베이크 스크립트용)
import { register } from "node:module";
register("./ts-alias-hooks.mjs", import.meta.url);
