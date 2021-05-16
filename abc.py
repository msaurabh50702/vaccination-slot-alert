def decrypt(input1):
    a = input1.split("+")
    n1 = a[0]
    n2 = a[1].split("=")[0]
    n3 = a[1].split("=")[1]

    print(n1,n2,n3)

    if n1 == 'X':
        return int(n3)-int(n2)
    elif n2 == 'X':
        return int(n3)-int(n1)
    elif n3 == 'X':
        return int(n1)+int(n2)





print(decrypt("5+X=7"))