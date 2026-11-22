export type User = {
    id: number
    email: string
    display_name: string
    timezone: string
}

export type RegisterInput = {
    email: string
    password: string
    display_name: string
    timezone: string
}