def solution(input_from_question,inp):
    lst = []
    flag = 0
    #inp = input().split(" ")
    inp = inp.split(" ")

    for x in inp:
        if len(x) != 6:
            lst.append(x)
            flag = 0

    if len(lst) == 0:
        return 0
    else:
        return " ".join(lst)


print(solution(5,"103010 12036 20626 2 661281"))


























def solution1(input_from_program):
    return sum(list(map(int,input_from_program.split(" "))))