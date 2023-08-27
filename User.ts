import { UserRecord } from "firebase-admin/lib/auth/user-record";
type User = Pick<UserRecord, "displayName" | "uid" | "photoURL">;
export default User;
