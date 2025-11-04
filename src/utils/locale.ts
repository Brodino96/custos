enum Generic {
    noPermission = "⛔ You don't have permission to do this",
    noSource = "⛔ Somehow you don't exist",
    noTarget = "⛔ Target user is null",
    dbFailure = "⛔ Failed to interact with the database",
}

export default class Locale {
    public static readonly generic = Generic
}